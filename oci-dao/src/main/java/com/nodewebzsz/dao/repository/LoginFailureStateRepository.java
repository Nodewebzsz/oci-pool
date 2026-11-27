package com.nodewebzsz.dao.repository;

import com.nodewebzsz.dao.entity.LoginFailureState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LoginFailureStateRepository extends JpaRepository<LoginFailureState, String> {
}
