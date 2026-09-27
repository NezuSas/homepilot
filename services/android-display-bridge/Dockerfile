FROM python:3.12-slim-bookworm

# Debian Bookworm's adb package provides the ADB client/server in this namespace.
RUN apt-get update \
    && apt-get install -y --no-install-recommends adb=1:29.0.6-28 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 displaybridge \
    && useradd --uid 10001 --gid 10001 --home-dir /var/lib/homepilot-display-adb --create-home --shell /usr/sbin/nologin displaybridge \
    && mkdir -p /var/lib/homepilot-display-adb/.android \
    && chown -R 10001:10001 /var/lib/homepilot-display-adb \
    && chmod 0700 /var/lib/homepilot-display-adb /var/lib/homepilot-display-adb/.android

ENV HOME=/var/lib/homepilot-display-adb \
    HOMEPILOT_DISPLAY_BRIDGE_BIND_HOST=0.0.0.0 \
    HOMEPILOT_DISPLAY_BRIDGE_PORT=5002 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY --chown=10001:10001 services/android-display-bridge/bridge ./bridge
USER 10001:10001

ARG HOMEPILOT_BUILD_REVISION=unknown
LABEL io.nezu.homepilot.managed="v1" \
      io.nezu.homepilot.service="display-bridge" \
      io.nezu.homepilot.role="runtime" \
      io.nezu.homepilot.revision="${HOMEPILOT_BUILD_REVISION}"

EXPOSE 5002
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5002/health', timeout=2)" || exit 1

CMD ["python", "-m", "bridge"]
