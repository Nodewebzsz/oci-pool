package com.doubledimple.ociserver.pojo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * @version 1.0.0
 * @ClassName OciPageResult
 * @Description TODO
 * @Author nodewebzsz
 * @Date 2025-10-31 11:25
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OciPageResult<T> {

    private List<T> data;
    private String nextPageToken; // 下一页标识

    /**
     * 是否为演示数据（MODERN_UI_MOCK_DATA=true 且真实查询为空或失败时置 true）。
     * 前端据此展示「演示数据」提示，避免把假数据当真。
     */
    @Builder.Default
    private boolean mock = false;
}
