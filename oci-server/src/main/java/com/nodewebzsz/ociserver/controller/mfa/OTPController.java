package com.nodewebzsz.ociserver.controller.mfa;

import cn.hutool.core.util.StrUtil;
import com.nodewebzsz.dao.entity.OTPKey;
import com.nodewebzsz.dao.repository.OTPKeyRepository;
import com.nodewebzsz.ociserver.controller.BaseController;
import com.nodewebzsz.ociserver.pojo.request.OtpBatchRequest;
import com.nodewebzsz.ociserver.pojo.response.OtpResponse;
import com.nodewebzsz.ociserver.pojo.response.OtpResponse2;
import com.nodewebzsz.ociserver.service.mfa.OTPService;
import com.nodewebzsz.ociserver.service.mfa.QRCodeService;
import com.nodewebzsz.ociserver.utils.google.GoogleAuthMigrationParser;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.Result;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import com.nodewebzsz.ociserver.config.context.UserContext;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.Resource;
import javax.imageio.ImageIO;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.PrintWriter;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;


/**
 * @author nodewebzsz
 * @date 2024:10:05日 01:00
 */
@Controller
@Slf4j
public class OTPController  extends BaseController {

    @Resource
    private OTPService otpService;

    @Resource
    private QRCodeService qrCodeService;

    @Resource
    private OTPKeyRepository otpKeyRepository;

    // 显示主页（PC）
    @GetMapping("/mfa/page")
    public String mfa(Model model) throws IOException, WriterException {
        List<OTPKey> otpKeys = otpService.getAllKeys();
        if (otpKeys.size() > 0){
            model.addAttribute("otpKeys", otpKeys);
        }
        model.addAttribute("activePage", "api-mfa");
        return "mfa";
    }

    // 移动端 MFA 页面
    @GetMapping("/m/mfa")
    public String mobileMfa(Model model) {
        List<OTPKey> otpKeys = otpService.getAllKeys();
        if (otpKeys != null && !otpKeys.isEmpty()) {
            model.addAttribute("otpKeys", otpKeys);
        }
        model.addAttribute("activePage", "mfa");
        model.addAttribute("currentUsername", UserContext.getUsername());
        return "mobile/mfa";
    }

    /**
     * 聚合返回 MFA 密钥列表（Mac / 原生客户端用）
     */
    @GetMapping("/api/mfa/keys")
    @ResponseBody
    public ResponseEntity<?> listKeysJson() {
        try {
            List<OTPKey> otpKeys = otpService.getAllKeys();
            List<Map<String, Object>> list = new ArrayList<>();
            if (otpKeys != null) {
                for (OTPKey k : otpKeys) {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", k.getId());
                    m.put("keyName", k.getKeyName());
                    m.put("secretKey", k.getSecretKey());
                    m.put("issuer", k.getIssuer() != null ? k.getIssuer() : "mfa-oci-pool");
                    m.put("qrCode", k.getQrCode());
                    list.add(m);
                }
            }
            Map<String, Object> body = new HashMap<>();
            body.put("success", true);
            body.put("data", list);
            return ResponseEntity.ok(body);
        } catch (Exception e) {
            log.error("获取 MFA 密钥列表失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(e.getMessage());
        }
    }

    // 保存密钥
    @PostMapping("/save-secret")
    public Object saveSecret(@RequestParam(value ="keyName", required = false) String keyName,
                             @RequestParam(value ="secretKey", required = false) String secretKey,
                             @RequestParam(value ="issuer", required = false) String issuer,
                             @RequestParam(value = "qrCode", required = false) MultipartFile qrCode,
                             @RequestParam(value = "qrUrl", required = false) String qrUrl,
                             HttpServletRequest request) {
        if (StringUtils.isNotBlank(secretKey))secretKey = StrUtil.trim(secretKey);
        AtomicReference<String> finalSecretKey = new AtomicReference<>(secretKey);
        String resolvedIssuer = StringUtils.isNotBlank(issuer) ? issuer.trim() : "mfa-oci-pool";
        List<Map<String, String>> accounts = new ArrayList<>();
        if(StringUtils.isEmpty(keyName)){
            keyName = System.currentTimeMillis()+"";
        }
        try {
        // 摄像头扫码直接传入 URL 文本（otpauth:// 或 otpauth-migration://）
        if (StringUtils.isNotBlank(qrUrl)) {
            String url = qrUrl.trim();
            log.info("qrUrl text is: {}", url);
            if (url.startsWith("otpauth-migration://")) {
                List<GoogleAuthMigrationParser.OtpParameters> otpParameters = GoogleAuthMigrationParser.parseUri(url);
                List<OTPKey> otpKeys = new ArrayList<>();
                for (GoogleAuthMigrationParser.OtpParameters account : otpParameters) {
                    OTPKey otpKey = new OTPKey();
                    otpKey.setKeyName(account.getName());
                    otpKey.setSecretKey(account.getSecretInBase32());
                    otpKey.setIssuer(account.getIssuer() != null ? account.getIssuer() : "mfa-start");
                    String otpAuthUri = String.format("otpauth://totp/%s:%s?secret=%s&issuer=%s",
                            otpKey.getIssuer(), otpKey.getKeyName(), otpKey.getSecretKey(), otpKey.getIssuer());
                    otpKey.setQrCode(qrCodeService.generateQRCodeImage(otpAuthUri));
                    OTPKey existing = otpKeyRepository.findBySecretKey(otpKey.getSecretKey());
                    otpKeys.add(existing != null ? existing : otpKey);
                }
                otpService.saveListKey(otpKeys);
            } else if (url.startsWith("otpauth://")) {
                URI uri = new URI(url);
                String query = uri.getQuery();
                Arrays.stream(query.split("&"))
                        .filter(param -> param.startsWith("secret="))
                        .findFirst()
                        .ifPresent(secret -> finalSecretKey.set(secret.substring(7)));
                if (finalSecretKey.get() == null || finalSecretKey.get().trim().isEmpty()) {
                    throw new IllegalArgumentException("Secret key is required");
                }
                OTPKey otpKey = new OTPKey(keyName, finalSecretKey.get());
                otpKey.setIssuer("mfa-start");
                if (otpKeyRepository.findBySecretKey(otpKey.getSecretKey()) == null) {
                    otpService.saveKey(otpKey);
                }
            }
        // 如果上传了二维码文件，则解析二维码
        } else if (qrCode != null && !qrCode.isEmpty()) {
            // 读取图片
            BufferedImage image = ImageIO.read(qrCode.getInputStream());
            if (image == null) {
                throw new IllegalArgumentException("Invalid image file");
            }

            // 使用ZXing解析二维码
            BinaryBitmap binaryBitmap = new BinaryBitmap(new HybridBinarizer(
                    new BufferedImageLuminanceSource(image)));
            Result result = new MultiFormatReader().decode(binaryBitmap);

            // 解析 otpauth:// URI
            String qrContent = result.getText();
            log.info("qrCode text is: {}",qrContent);
            if (qrContent.startsWith("otpauth://")) {
                URI uri = new URI(qrContent);
                String query = uri.getQuery();
                // 从查询参数中获取 secret
                Arrays.stream(query.split("&"))
                        .filter(param -> param.startsWith("secret="))
                        .findFirst()
                        .ifPresent(secret -> {
                            finalSecretKey.set(secret.substring(7));// 去掉 "secret=" 前缀
                        });
                // 验证 secretKey 不为空
                if (finalSecretKey.get() == null || finalSecretKey.get().trim().isEmpty()) {
                    throw new IllegalArgumentException("Secret key is required");
                }
                OTPKey otpKey = new OTPKey(keyName, finalSecretKey.get());
                otpKey.setIssuer("mfa-start");
                OTPKey byKeyName = otpKeyRepository.findBySecretKey(otpKey.getSecretKey());
                if (byKeyName == null){
                    otpService.saveKey(otpKey);
                }

            } else if (qrContent.startsWith("otpauth-migration://")) {

                List<GoogleAuthMigrationParser.OtpParameters> otpParameters = GoogleAuthMigrationParser.parseUri(qrContent);
                List<OTPKey> otpKeys = new ArrayList<>();
                for (GoogleAuthMigrationParser.OtpParameters account : otpParameters) {
                    OTPKey otpKey = new OTPKey();
                    otpKey.setKeyName(account.getName());
                    otpKey.setSecretKey(account.getSecretInBase32());
                    if (account.getIssuer() == null){
                        otpKey.setIssuer("mfa-start");
                    }else {
                        otpKey.setIssuer(account.getIssuer());
                    }
                    String otpAuthUri = String.format("otpauth://totp/%s:%s?secret=%s&issuer=%s",
                            otpKey.getIssuer(), otpKey.getKeyName(), otpKey.getSecretKey(), otpKey.getIssuer());

                    String qrCodeNew = qrCodeService.generateQRCodeImage(otpAuthUri);
                    otpKey.setQrCode(qrCodeNew);
                    OTPKey byKeyName = otpKeyRepository.findBySecretKey(otpKey.getSecretKey());
                    if (byKeyName != null){
                        otpKeys.add(byKeyName);
                    }else {
                        otpKeys.add(otpKey);
                    }

                }
                otpService.saveListKey(otpKeys);
            }
        }else {
            OTPKey byKeyName = otpKeyRepository.findByKeyName(keyName);
            if (byKeyName == null){
                byKeyName = new OTPKey(keyName, secretKey);
            } else {
                byKeyName.setSecretKey(secretKey);
            }
            byKeyName.setIssuer(resolvedIssuer);
            try {
                String otpAuthUri = String.format("otpauth://totp/%s:%s?secret=%s&issuer=%s",
                        byKeyName.getIssuer(), byKeyName.getKeyName(), byKeyName.getSecretKey(), byKeyName.getIssuer());
                byKeyName.setQrCode(qrCodeService.generateQRCodeImage(otpAuthUri));
            } catch (Exception ignored) {}
            otpService.saveKey(byKeyName);
        }
        log.info("result:{}",accounts);
        boolean isAjax = request != null && ("XMLHttpRequest".equalsIgnoreCase(request.getHeader("X-Requested-With"))
                || (request.getHeader("Accept") != null && request.getHeader("Accept").contains("application/json")));
        if (isAjax) {
            Map<String, Object> resp = new HashMap<>();
            resp.put("success", true);
            resp.put("message", "保存成功");
            return ResponseEntity.ok(resp);
        }
        return "redirect:/mfa/page";
    } catch (Exception e) {
        log.error("保存秘钥出现异常", e);
        boolean isAjax = request != null && ("XMLHttpRequest".equalsIgnoreCase(request.getHeader("X-Requested-With"))
                || (request.getHeader("Accept") != null && request.getHeader("Accept").contains("application/json")));
        if (isAjax) {
            Map<String, Object> resp = new HashMap<>();
            resp.put("success", false);
            resp.put("message", e.getMessage() != null ? e.getMessage() : "保存密钥失败");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(resp);
        }
        return "redirect:/mfa/page";
    }
    }

    // 生成 OTP 码
    @GetMapping("/generate-otp")
    @ResponseBody
    public OtpResponse2 generateOtp(@RequestParam("secretKey") String secretKey) {
        String otpCode = otpService.generateOtpCode(secretKey);
        return new OtpResponse2(otpCode);
    }

    // 生成 OTP 码
    @PostMapping("/generate-otp-batch")
    public ResponseEntity<List<OtpResponse>> generateOtpBatch(@RequestBody OtpBatchRequest request) {
        try {
            List<OtpResponse> otpResponses = otpService.generateOtpBatch(request.getSecretKeys());
            return ResponseEntity.ok(otpResponses);
        } catch (Exception e) {
            log.error("Error generating OTP batch", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/delete-key")
    @ResponseBody
    public OtpResponse2 deleteKey(@RequestBody Map<String, String> payload) {
        String keyName = payload.get("keyName");
        if (keyName == null || keyName.isEmpty()) {
            return new OtpResponse2("keyName is null");
        }
        otpService.deleteKey(keyName);
        return new OtpResponse2("OK");
    }


    @GetMapping("/export-data")
    public void exportToCSV(HttpServletResponse response) throws IOException {
        response.setContentType("text/csv");
        response.setHeader("Content-Disposition", "attachment; filename=\"otp_keys.csv\"");
        PrintWriter writer = response.getWriter();
        writer.println("Key Name,Issuer,Secret Key,Created Date");

        List<OTPKey> otpKeys = otpService.getAllKeys();
        for (OTPKey otpKey : otpKeys) {
            writer.printf("%s,%s,%s,%s%n", otpKey.getKeyName(), otpKey.getIssuer(), otpKey.getSecretKey(),otpKey.getCreateTime());
        }
        writer.flush();
    }
}
