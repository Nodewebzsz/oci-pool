# 使用轻量级的 JRE 运行环境
#FROM --platform=$TARGETPLATFORM eclipse-temurin:17-jre-jammy
FROM eclipse-temurin:17-jre-jammy

WORKDIR /oci-pool

# 创建必要的目录
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /oci-pool/data \
    && mkdir -p /oci-pool/logs

# 设置环境变量
ENV SERVER_PORT=9856
ENV DATA_PATH=/oci-pool/data
ENV LOG_HOME=/oci-pool/logs
ENV TZ=Asia/Shanghai

# 直接复制本地已构建好的 jar
COPY target/oci-pool-release.jar oci-pool.jar

# JVM 配置 - 仅使用 G1 垃圾收集器
ENV JAVA_OPTS="-XX:+UseG1GC -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/oci-pool/logs"

# 暴露端口（使用环境变量）
EXPOSE ${SERVER_PORT}

# 设置挂载卷
VOLUME ["/oci-pool/data", "/oci-pool/logs"]

# 启动命令
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS \
    -Duser.timezone=$TZ \
    -DSERVER_PORT=$SERVER_PORT \
    -DDATA_PATH=$DATA_PATH \
    -DLOG_HOME=$LOG_HOME \
    -jar oci-pool.jar"]
