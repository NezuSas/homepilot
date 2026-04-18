# [TDR-003] Sonoff Integration Strategy: Bridged Integration via Home Assistant

## 1. Decision
HomePilot will utilize **Home Assistant (HA)** as the primary integration bridge for Sonoff devices for the current development cycle. Direct local orchestration via the Sonoff DIY mDNS/REST sub-protocol is postponed for production deployments.

## 2. Architectural Context
This strategy aligns with the HomePilot 3-layer modular architecture:

*   **Device Layer**: Edge hardware (Sonoff switches, plugs).
*   **Integration Layer**: A **decoupled integration layer** using specialized bridges (Home Assistant) to handle vendor-specific protocols. Home Assistant is a replaceable integration adapter, not part of the core system.
*   **Orchestration Layer**: **HomePilot**, serving as the system of record and automation engine.

HomeAssistant is positioned strictly as a protocol translator within the Integration Layer, ensuring HomePilot remains the primary Orchestrator.

## 3. Evidence & Findings
Technical evaluation of stock Sonoff firmware revealed several critical limitations for direct local-first (Edge) execution:
- **Discovery Issues**: No reliable mDNS discovery traffic observed in local network testing.
- **Service Unresponsiveness**: Observed consistent failure on `:8081/zeroconf/info` endpoints, even during manual interrogation.
- **Connectivity Reality**: Devices frequently require an active WAN connection to initialize local interfaces, contradicting HomePilot’s requirement for zero-internet autonomy.

## 4. Decision Rationale
Direct local integration with stock Sonoff firmware is postponed based on the following factors:
- **API Instability**: Lack of publicly documented and stable local API surface for reliable third-party control.
- **Non-Deterministic Behavior**: Lack of guaranteed response times and protocol state stability.
- **Vendor Lock-in**: Firmware constraints that prioritize vendor cloud synchronization over local discovery.
- **Lack of Guaranteed Offline Execution**: Failure to maintain control states during prolonged WAN outages without specialized bridging.

## 5. Current Operational Path
The system will maintain operational stability through the following pipeline:

**HomePilot Orchestrator** → **Home Assistant (Bridge)** → **Sonoff Device**

This path leverage HA's mature driver ecosystem to stabilize vendor-specific communication while delegating logic and state management to HomePilot.

## 6. Strategic Positioning
This is a **transitional integration strategy** intended to accelerate deployment without compromising system stability. It is NOT the final architecture for Sonoff-class hardware within the HomePilot ecosystem.

## 7. Future Evaluation Plan
A controlled pilot phase is scheduled for:
- **Firmware Decoupling**: Testing ESPHome or Tasmota on a **single device** to evaluate pure local-first execution.
- **Verification**: Validating latency and reliability improvements when bypassing vendor-specific protocols.
- **Zero Impact**: Pilot tests will be isolated and will not affect production stability.

## 8. Long-Term Direction
HomePilot’s long-term hardware strategy prioritizes:
- **Preferred Protocols**: Zigbee, Matter (Native Local), and ESPHome (Local API).
- **Phased Avoidance**: Systematic avoidance of cloud-locked WiFi ecosystems for critical home infrastructure.

## 9. Status
- **Implementation Status**: Active / Transitional
- **Development Impact**: Non-blocking
- **Safety Rating**: Production-safe
