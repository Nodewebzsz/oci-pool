package com.nodewebzsz.ociserver.config;

import cn.dev33.satoken.dao.SaTokenDao;
import cn.dev33.satoken.stp.SaLoginModel;
import cn.dev33.satoken.stp.StpUtil;

/**
 * 统一登录会话签发策略：
 * - rememberMe=true：持久化 Cookie，30 天有效，且不因 2 小时无操作（active-timeout）被提前踢下线。
 * - rememberMe=false：临时会话 Cookie，沿用全局 active-timeout（2 小时无操作失效）。
 */
public final class AuthSessionHelper {

    public static final long REMEMBER_ME_TIMEOUT_SECONDS = 30L * 24L * 60L * 60L;

    private AuthSessionHelper() {
    }

    public static void login(Object loginId, boolean rememberMe) {
        StpUtil.login(loginId, buildLoginModel(rememberMe));
    }

    public static SaLoginModel buildLoginModel(boolean rememberMe) {
        SaLoginModel model = SaLoginModel.create()
                .setIsLastingCookie(rememberMe);
        if (rememberMe) {
            model.setTimeout(REMEMBER_ME_TIMEOUT_SECONDS)
                    .setActiveTimeout(SaTokenDao.NEVER_EXPIRE);
        }
        return model;
    }
}
