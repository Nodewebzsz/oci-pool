package com.nodewebzsz.ociserver.service.quality;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.nodewebzsz.dao.entity.NetworkQualityAssignment;
import com.nodewebzsz.dao.entity.NetworkQualityCredential;
import com.nodewebzsz.dao.entity.NetworkQualitySample;
import com.nodewebzsz.dao.entity.NetworkQualityTask;
import com.nodewebzsz.dao.repository.NetworkQualityAssignmentRepository;
import com.nodewebzsz.dao.repository.NetworkQualityCredentialRepository;
import com.nodewebzsz.dao.repository.NetworkQualityInstanceRepository;
import com.nodewebzsz.dao.repository.NetworkQualitySampleRepository;
import com.nodewebzsz.dao.repository.NetworkQualityTaskRepository;
import com.nodewebzsz.ocimonitor.service.quality.AgentCredentialReceipt;
import com.nodewebzsz.ocimonitor.service.quality.NetworkQualityException;
import com.nodewebzsz.ocimonitor.service.quality.NetworkQualityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class NetworkQualityServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<Long, NetworkQualityTask> taskStore = new LinkedHashMap<>();
    private final Map<Long, NetworkQualityCredential> credentialStore = new LinkedHashMap<>();
    private final Map<Long, NetworkQualityAssignment> assignmentStore = new LinkedHashMap<>();
    private final Map<Long, NetworkQualitySample> sampleStore = new LinkedHashMap<>();
    private final Set<Long> existingInstanceIds = new HashSet<>(Arrays.asList(101L, 102L));
    private final AtomicLong taskIdGen = new AtomicLong(1);
    private final AtomicLong assignmentIdGen = new AtomicLong(1);
    private final AtomicLong sampleIdGen = new AtomicLong(1);

    private NetworkQualityService service;

    @BeforeEach
    void setUp() {
        taskStore.clear();
        credentialStore.clear();
        assignmentStore.clear();
        sampleStore.clear();
        taskIdGen.set(1);
        assignmentIdGen.set(1);
        sampleIdGen.set(1);

        NetworkQualityTaskRepository tasks = mock(NetworkQualityTaskRepository.class);
        NetworkQualityCredentialRepository credentials = mock(NetworkQualityCredentialRepository.class);
        NetworkQualityAssignmentRepository assignments = mock(NetworkQualityAssignmentRepository.class);
        NetworkQualitySampleRepository samples = mock(NetworkQualitySampleRepository.class);
        NetworkQualityInstanceRepository instances = mock(NetworkQualityInstanceRepository.class);

        PlatformTransactionManager txManager = new PlatformTransactionManager() {
            @Override
            public TransactionStatus getTransaction(TransactionDefinition definition) {
                return new SimpleTransactionStatus();
            }

            @Override
            public void commit(TransactionStatus status) {
            }

            @Override
            public void rollback(TransactionStatus status) {
            }
        };

        when(tasks.count()).thenAnswer(inv -> (long) taskStore.size());
        when(tasks.saveAndFlush(any(NetworkQualityTask.class))).thenAnswer(inv -> {
            NetworkQualityTask task = inv.getArgument(0);
            if (task.getId() == null) {
                task.setId(taskIdGen.getAndIncrement());
                task.setVersion(0L);
            } else {
                task.setVersion((task.getVersion() == null ? 0L : task.getVersion()) + 1L);
            }
            taskStore.put(task.getId(), task);
            return task;
        });
        when(tasks.lockById(anyLong())).thenAnswer(inv -> Optional.ofNullable(taskStore.get(inv.getArgument(0))));
        when(tasks.findById(anyLong())).thenAnswer(inv -> Optional.ofNullable(taskStore.get(inv.getArgument(0))));
        when(tasks.findAll(any(Pageable.class))).thenAnswer(inv -> new PageImpl<>(new ArrayList<>(taskStore.values())));
        doAnswer(inv -> {
            NetworkQualityTask task = inv.getArgument(0);
            taskStore.remove(task.getId());
            return null;
        }).when(tasks).delete(any(NetworkQualityTask.class));

        when(credentials.lockByInstance(anyLong())).thenAnswer(inv -> Optional.ofNullable(credentialStore.get(inv.getArgument(0))));
        when(credentials.saveAndFlush(any(NetworkQualityCredential.class))).thenAnswer(inv -> {
            NetworkQualityCredential credential = inv.getArgument(0);
            credentialStore.put(credential.getInstanceId(), credential);
            return credential;
        });
        when(credentials.lockByHash(anyString())).thenAnswer(inv -> {
            String hash = inv.getArgument(0);
            return credentialStore.values().stream()
                    .filter(c -> hash.equals(c.getTokenHash()) || hash.equals(c.getPendingHash()))
                    .findFirst();
        });
        when(credentials.findAllById(any())).thenAnswer(inv -> {
            Iterable<Long> ids = inv.getArgument(0);
            List<NetworkQualityCredential> list = new ArrayList<>();
            for (Long id : ids) {
                NetworkQualityCredential cred = credentialStore.get(id);
                if (cred != null) list.add(cred);
            }
            return list;
        });

        when(assignments.save(any(NetworkQualityAssignment.class))).thenAnswer(inv -> {
            NetworkQualityAssignment link = inv.getArgument(0);
            if (link.getId() == null) {
                link.setId(assignmentIdGen.getAndIncrement());
            }
            assignmentStore.put(link.getId(), link);
            return link;
        });
        when(assignments.lockForTask(anyLong())).thenAnswer(inv -> {
            Long taskId = inv.getArgument(0);
            return assignmentStore.values().stream()
                    .filter(a -> taskId.equals(a.getTaskId()))
                    .collect(Collectors.toList());
        });
        when(assignments.lockForInstance(anyLong())).thenAnswer(inv -> {
            Long instanceId = inv.getArgument(0);
            return assignmentStore.values().stream()
                    .filter(a -> instanceId.equals(a.getInstanceId()))
                    .collect(Collectors.toList());
        });
        when(assignments.lockPair(anyLong(), anyLong())).thenAnswer(inv -> {
            Long instanceId = inv.getArgument(0);
            Long taskId = inv.getArgument(1);
            return assignmentStore.values().stream()
                    .filter(a -> instanceId.equals(a.getInstanceId()) && taskId.equals(a.getTaskId()))
                    .findFirst();
        });
        when(assignments.findByInstanceIdAndTaskId(anyLong(), anyLong())).thenAnswer(inv -> {
            Long instanceId = inv.getArgument(0);
            Long taskId = inv.getArgument(1);
            return assignmentStore.values().stream()
                    .filter(a -> instanceId.equals(a.getInstanceId()) && taskId.equals(a.getTaskId()))
                    .findFirst();
        });
        when(assignments.findAll(any(Pageable.class))).thenAnswer(inv -> new PageImpl<>(new ArrayList<>(assignmentStore.values())));
        doAnswer(inv -> {
            NetworkQualityAssignment link = inv.getArgument(0);
            assignmentStore.remove(link.getId());
            return null;
        }).when(assignments).delete(any(NetworkQualityAssignment.class));
        doAnswer(inv -> {
            Iterable<NetworkQualityAssignment> items = inv.getArgument(0);
            for (NetworkQualityAssignment item : items) {
                assignmentStore.remove(item.getId());
            }
            return null;
        }).when(assignments).deleteAll(any());

        when(samples.saveAndFlush(any(NetworkQualitySample.class))).thenAnswer(inv -> {
            NetworkQualitySample sample = inv.getArgument(0);
            if (sample.getId() == null) {
                sample.setId(sampleIdGen.getAndIncrement());
            }
            sampleStore.put(sample.getId(), sample);
            return sample;
        });
        when(samples.window(anyLong(), anyLong(), anyLong(), anyLong(), anyLong(), any(Pageable.class))).thenAnswer(inv -> {
            Long instanceId = inv.getArgument(0);
            Long taskId = inv.getArgument(1);
            Long revision = inv.getArgument(2);
            Long from = inv.getArgument(3);
            Long to = inv.getArgument(4);
            return sampleStore.values().stream()
                    .filter(s -> instanceId.equals(s.getInstanceId()) && taskId.equals(s.getTaskId())
                            && revision.equals(s.getRevision()) && s.getUpdatedAt() >= from && s.getUpdatedAt() <= to)
                    .sorted(Comparator.comparing(NetworkQualitySample::getUpdatedAt).reversed())
                    .collect(Collectors.toList());
        });
        when(samples.statistics(anyLong(), anyLong(), anyLong(), anyLong(), anyLong())).thenAnswer(inv -> {
            Long instanceId = inv.getArgument(0);
            Long taskId = inv.getArgument(1);
            Long revision = inv.getArgument(2);
            Long from = inv.getArgument(3);
            Long to = inv.getArgument(4);
            List<NetworkQualitySample> matching = sampleStore.values().stream()
                    .filter(s -> instanceId.equals(s.getInstanceId()) && taskId.equals(s.getTaskId())
                            && revision.equals(s.getRevision()) && s.getUpdatedAt() >= from && s.getUpdatedAt() <= to)
                    .collect(Collectors.toList());
            return new NetworkQualitySampleRepository.WindowStats() {
                @Override public Long getCount() { return (long) matching.size(); }
                @Override public Long getSuccessCount() { return matching.stream().filter(s -> "success".equals(s.getStatus())).count(); }
                @Override public Long getPartialCount() { return matching.stream().filter(s -> "partial".equals(s.getStatus())).count(); }
                @Override public Long getFailedCount() { return matching.stream().filter(s -> "failed".equals(s.getStatus())).count(); }
                @Override public Long getUnsupportedCount() { return matching.stream().filter(s -> "unsupported".equals(s.getStatus())).count(); }
                @Override public Long getErrorCount() { return matching.stream().filter(s -> "error".equals(s.getStatus())).count(); }
                @Override public Long getUnknownCount() { return matching.stream().filter(s -> "unknown".equals(s.getStatus())).count(); }
                @Override public Long getAttempts() { return matching.stream().mapToLong(s -> s.getAttempts() == null ? 0 : s.getAttempts()).sum(); }
                @Override public Long getSuccessful() { return matching.stream().mapToLong(s -> s.getSuccessful() == null ? 0 : s.getSuccessful()).sum(); }
                @Override public Double getWeightedMs() {
                    return matching.stream()
                            .filter(s -> s.getAvgMs() != null && s.getSuccessful() != null)
                            .mapToDouble(s -> s.getAvgMs() * s.getSuccessful())
                            .sum();
                }
                @Override public Double getMinMs() {
                    return matching.stream().map(NetworkQualitySample::getMinMs).filter(Objects::nonNull).min(Double::compare).orElse(null);
                }
                @Override public Double getMaxMs() {
                    return matching.stream().map(NetworkQualitySample::getMaxMs).filter(Objects::nonNull).max(Double::compare).orElse(null);
                }
            };
        });
        when(samples.deleteTaskHistory(anyLong())).thenAnswer(inv -> {
            Long taskId = inv.getArgument(0);
            int before = sampleStore.size();
            sampleStore.values().removeIf(s -> taskId.equals(s.getTaskId()));
            return before - sampleStore.size();
        });

        when(instances.existsById(anyLong())).thenAnswer(inv -> existingInstanceIds.contains(inv.getArgument(0)));
        when(instances.existingIds(any())).thenAnswer(inv -> {
            List<Long> ids = inv.getArgument(0);
            return ids.stream().filter(existingInstanceIds::contains).collect(Collectors.toList());
        });

        service = new NetworkQualityService();
        ReflectionTestUtils.setField(service, "tasks", tasks);
        ReflectionTestUtils.setField(service, "credentials", credentials);
        ReflectionTestUtils.setField(service, "assignments", assignments);
        ReflectionTestUtils.setField(service, "samples", samples);
        ReflectionTestUtils.setField(service, "instances", instances);
        ReflectionTestUtils.setField(service, "transactionManager", txManager);
    }

    @Test
    void taskCrudAndOptimisticVersionConflict() {
        ObjectNode createReq = mapper.createObjectNode()
                .put("name", "上海电信")
                .put("operator", "telecom")
                .put("region", "上海")
                .put("type", "tcp")
                .put("target", "1.1.1.1:443")
                .put("intervalSeconds", 60)
                .put("sampleCount", 3)
                .put("enabled", true);
        createReq.putArray("instanceIds").add("101");

        Map<String, Object> created = service.createTask(createReq);
        assertEquals("1", created.get("id"));
        assertEquals("0", created.get("version"));

        ObjectNode staleUpdate = createReq.deepCopy().put("version", "99");
        NetworkQualityException conflict = assertThrows(NetworkQualityException.class,
                () -> service.updateTask("1", staleUpdate));
        assertEquals(409, conflict.getStatus());

        ObjectNode validUpdate = createReq.deepCopy().put("version", "0").put("name", "上海电信-TCP");
        validUpdate.putArray("instanceIds").add("101").add("102");
        Map<String, Object> updated = service.updateTask("1", validUpdate);
        assertEquals("1", updated.get("version"));
        assertEquals("上海电信-TCP", updated.get("name"));

        Map<String, Object> deleted = service.deleteTask("1", "1");
        assertEquals(true, deleted.get("deleted"));
        assertTrue(taskStore.isEmpty());
    }

    @Test
    @SuppressWarnings("unchecked")
    void credentialActivationPollReportAndHistoryStats() {
        ObjectNode createReq = mapper.createObjectNode()
                .put("name", "广州联通")
                .put("operator", "unicom")
                .put("region", "广州")
                .put("type", "http")
                .put("target", "https://example.com/health")
                .put("intervalSeconds", 120)
                .put("sampleCount", 3)
                .put("enabled", true);
        createReq.putArray("instanceIds").add("101");
        service.createTask(createReq);

        AgentCredentialReceipt receipt = service.issueAgentCredential("101");
        String auth = "Bearer " + receipt.getCredential();

        ObjectNode pollReq = mapper.createObjectNode()
                .put("version", "1")
                .put("availableSlots", 4);
        pollReq.putArray("capabilities").add("icmp").add("tcp").add("http");

        Map<String, Object> pollResp = service.poll(auth, pollReq);
        List<Map<String, Object>> jobs = (List<Map<String, Object>>) pollResp.get("jobs");
        assertEquals(1, jobs.size());
        Map<String, Object> job = jobs.get(0);
        assertEquals("1", job.get("taskId"));
        assertEquals("http", job.get("type"));

        ObjectNode reportReq = mapper.createObjectNode()
                .put("taskId", (String) job.get("taskId"))
                .put("executionId", (String) job.get("executionId"))
                .put("revision", (String) job.get("revision"))
                .put("status", "partial")
                .put("attempts", 3)
                .put("successful", 2)
                .put("avgMs", 45.0)
                .put("minMs", 40.0)
                .put("maxMs", 50.0)
                .put("httpStatus", 200);

        Map<String, Object> reportResp = service.report(auth, reportReq);
        assertEquals(true, reportResp.get("accepted"));

        Map<String, Object> history = service.history("101", "1", "0", 24);
        List<Map<String, Object>> points = (List<Map<String, Object>>) history.get("points");
        assertEquals(1, points.size());
        Map<String, Object> stats = (Map<String, Object>) history.get("stats");
        assertEquals(1L, stats.get("count"));
        assertEquals(45.0, (Double) stats.get("avgMs"), 0.01);
        assertEquals(33.33, (Double) stats.get("lossPercent"), 0.1);

        // Manual trigger queues job immediately even before nextDue
        ObjectNode runReq = mapper.createObjectNode().put("version", "0");
        Map<String, Object> runResp = service.runTask("1", runReq);
        assertEquals(1, runResp.get("queued"));

        Map<String, Object> secondPoll = service.poll(auth, pollReq);
        assertEquals(1, ((List<?>) secondPoll.get("jobs")).size());

        // Revocation rejects subsequent polls with 401
        service.revokeAgentCredential("101");
        NetworkQualityException unauthorized = assertThrows(NetworkQualityException.class,
                () -> service.poll(auth, pollReq));
        assertEquals(401, unauthorized.getStatus());
    }
}
