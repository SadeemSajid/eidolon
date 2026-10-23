# 0009: Show component readiness separately from board availability

Status: Accepted.

Add a Components tab beside Board Library and Custom SoC. Board cards show their
name and machine without repeating the QEMU version or inventory label; detailed
board provenance stays in the inspector and documentation.

The read-only catalog uses firmware/component-readiness.json for reviewed
peripheral capability metadata. Keep model availability, bare-metal driver
availability, boot validation and custom-SoC backend readiness distinct. Current
UART/RTC/GPIO entries describe single-instance polling drivers validated on Arm
virt, not arbitrary composition or FreeRTOS/Linux support. Expandable details
show APIs and limitations; users can search by peripheral, model or API.

This metadata does not select firmware, launch a guest or add canvas devices.
Python tests connect readiness entries to registered component sources and named
boot regressions. Update metadata and real behavioral evidence together when
capabilities change; object discovery alone cannot establish driver readiness.
