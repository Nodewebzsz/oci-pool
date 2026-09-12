package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.dao.entity.Memo;

import java.util.List;

public interface MemoService {
    List<Memo> getAllMemos();
    Memo getMemoById(Long id);
    Memo createMemo(Memo memo);
    Memo updateMemo(Long id, Memo memo);
    void deleteMemo(Long id);
}
