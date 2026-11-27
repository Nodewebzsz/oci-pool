package com.nodewebzsz.ociserver.service.impl;

import org.apache.commons.io.input.Tailer;
import org.apache.commons.io.input.TailerListenerAdapter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class LogServiceStreamLifecycleTest {

    @TempDir
    Path tempDir;

    static class RecordingEmitter extends SseEmitter {
        final AtomicInteger errorCalls = new AtomicInteger();
        final AtomicReference<Throwable> lastError = new AtomicReference<>();
        final AtomicReference<Runnable> completionCallback = new AtomicReference<>();
        final AtomicReference<Runnable> timeoutCallback = new AtomicReference<>();
        final AtomicBoolean failOnSend = new AtomicBoolean(false);
        final AtomicBoolean failOnLineSend = new AtomicBoolean(false);

        RecordingEmitter() {
            super(0L);
        }

        @Override
        public synchronized void onCompletion(Runnable callback) {
            completionCallback.set(callback);
            super.onCompletion(callback);
        }

        @Override
        public synchronized void onTimeout(Runnable callback) {
            timeoutCallback.set(callback);
            super.onTimeout(callback);
        }

        @Override
        public void send(SseEventBuilder builder) throws IOException {
            if (failOnSend.get()) {
                throw new IOException("initial send failed");
            }
        }

        @Override
        public void send(Object object) throws IOException {
            if (failOnLineSend.get()) {
                throw new IOException("client disconnected");
            }
        }

        @Override
        public synchronized void completeWithError(Throwable ex) {
            errorCalls.incrementAndGet();
            lastError.set(ex);
            super.completeWithError(ex);
        }
    }

    @Test
    void missingFileFailsEmitterWithoutSubmittingWorker() {
        RecordingEmitter emitter = new RecordingEmitter();
        AtomicBoolean submitted = new AtomicBoolean(false);
        LogServiceImpl service = new LogServiceImpl() {
            @Override
            SseEmitter createEmitter() {
                return emitter;
            }
        };
        ReflectionTestUtils.setField(service, "sseLogExecutor", (Executor) task -> submitted.set(true));

        File missing = tempDir.resolve("missing.log").toFile();
        service.streamLogFile(missing, false);

        assertFalse(submitted.get());
        assertEquals(1, emitter.errorCalls.get());
        assertInstanceOf(IllegalStateException.class, emitter.lastError.get());
    }

    @Test
    void executorRejectionStopsTailerAndFailsEmitterOnce() throws IOException {
        File logFile = tempDir.resolve("app.log").toFile();
        assertTrue(logFile.createNewFile());

        RecordingEmitter emitter = new RecordingEmitter();
        AtomicInteger stopCalls = new AtomicInteger();
        LogServiceImpl service = new LogServiceImpl() {
            @Override
            SseEmitter createEmitter() {
                return emitter;
            }

            @Override
            Tailer createTailer(File file, TailerListenerAdapter listener) {
                return new Tailer(file, listener, 1000, true) {
                    @Override
                    public void stop() {
                        stopCalls.incrementAndGet();
                    }
                };
            }
        };
        ReflectionTestUtils.setField(service, "sseLogExecutor", (Executor) task -> {
            throw new RejectedExecutionException("pool full");
        });

        service.streamLogFile(logFile, false);

        assertEquals(1, stopCalls.get());
        assertEquals(1, emitter.errorCalls.get());
    }

    @Test
    void fileNotFoundAndSendErrorStopTailerAndFailOnce() throws IOException {
        File logFile = tempDir.resolve("app.log").toFile();
        assertTrue(logFile.createNewFile());

        RecordingEmitter emitter = new RecordingEmitter();
        emitter.failOnLineSend.set(true);
        AtomicInteger stopCalls = new AtomicInteger();
        AtomicReference<TailerListenerAdapter> capturedListener = new AtomicReference<>();
        LogServiceImpl service = new LogServiceImpl() {
            @Override
            SseEmitter createEmitter() {
                return emitter;
            }

            @Override
            Tailer createTailer(File file, TailerListenerAdapter listener) {
                capturedListener.set(listener);
                return new Tailer(file, listener, 1000, true) {
                    @Override
                    public void run() {
                        listener.handle("2026-11-26 10:00:00 [main] INFO OciLogBuilder - ok");
                        listener.fileNotFound();
                    }

                    @Override
                    public void stop() {
                        stopCalls.incrementAndGet();
                    }
                };
            }
        };
        ReflectionTestUtils.setField(service, "sseLogExecutor", (Executor) Runnable::run);

        service.streamLogFile(logFile, true);

        assertNotNull(capturedListener.get());
        assertEquals(1, stopCalls.get());
        assertEquals(1, emitter.errorCalls.get());
    }

    @Test
    void completionCallbackBeforeRunPreventsTailerStartAndStopsTailer() throws IOException {
        File logFile = tempDir.resolve("app.log").toFile();
        assertTrue(logFile.createNewFile());

        RecordingEmitter emitter = new RecordingEmitter();
        AtomicBoolean tailerRan = new AtomicBoolean(false);
        AtomicInteger stopCalls = new AtomicInteger();
        AtomicReference<Runnable> queuedTask = new AtomicReference<>();
        LogServiceImpl service = new LogServiceImpl() {
            @Override
            SseEmitter createEmitter() {
                return emitter;
            }

            @Override
            Tailer createTailer(File file, TailerListenerAdapter listener) {
                return new Tailer(file, listener, 1000, true) {
                    @Override
                    public void run() {
                        tailerRan.set(true);
                    }

                    @Override
                    public void stop() {
                        stopCalls.incrementAndGet();
                    }
                };
            }
        };
        ReflectionTestUtils.setField(service, "sseLogExecutor", (Executor) queuedTask::set);

        service.streamLogFile(logFile, false);
        assertNotNull(queuedTask.get());

        emitter.completionCallback.get().run();
        queuedTask.get().run();

        assertFalse(tailerRan.get());
        assertEquals(1, stopCalls.get());
        assertEquals(0, emitter.errorCalls.get());
    }
}
