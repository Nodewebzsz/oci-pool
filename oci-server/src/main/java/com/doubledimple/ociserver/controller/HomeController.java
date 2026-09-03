package com.doubledimple.ociserver.controller;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** Modern UI patch: guarded by modern-ui.enabled=false to avoid ambiguous GET / mapping. */
@Controller
@ConditionalOnProperty(name = "modern-ui.enabled", havingValue = "false")
public class HomeController extends BaseController {
    @GetMapping("/")
    public String home() { return "redirect:/login"; }
}
