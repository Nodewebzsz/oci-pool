package com.nodewebzsz.ociserver.service.impl;

import com.nodewebzsz.dao.entity.Memo;
import com.nodewebzsz.dao.repository.MemoRepository;
import com.nodewebzsz.ociserver.service.MemoService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;
import java.util.List;

/**
 * @author nodewebzsz
 * @date 2024:11:24日 12:42
 */
@Slf4j
@Service
public class MemoServiceImpl implements MemoService {

    @Resource
    private MemoRepository memoRepository;

    @Override
    public List<Memo> getAllMemos() {
        return memoRepository.findAllByOrderByCreateTimeDesc();
    }

    @Override
    public Memo getMemoById(Long id) {
        return memoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Memo not found with id: " + id));
    }

    @Override
    @Transactional
    public Memo createMemo(Memo memo) {
        return memoRepository.save(memo);
    }

    @Override
    @Transactional
    public Memo updateMemo(Long id, Memo memo) {
        Memo existingMemo = getMemoById(id);
        existingMemo.setTitle(memo.getTitle());
        existingMemo.setSummary(memo.getSummary());
        existingMemo.setContent(memo.getContent());
        return memoRepository.save(existingMemo);
    }

    @Override
    @Transactional
    public void deleteMemo(Long id) {
        memoRepository.deleteById(id);
    }
}
