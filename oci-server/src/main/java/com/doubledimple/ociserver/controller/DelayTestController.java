package com.doubledimple.ociserver.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

/** Split out of HomeController so guarding HomeController with @ConditionalOnProperty
 * doesn't accidentally disable this endpoint too. */
@Controller
public class DelayTestController extends BaseController {
    @GetMapping("/delayTest")
    public String showChatPage(Model model){
        model.addAttribute("activePage", "api-delayTest");
        return "speed_test";
    }
}
