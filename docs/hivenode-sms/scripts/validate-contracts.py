"""Validate projected JSON schemas and representative payloads; never call product APIs."""
import json
import re
from datetime import datetime
from pathlib import Path

try:
    from jsonschema import Draft202012Validator, FormatChecker
    from referencing import Registry, Resource
except ImportError as exc:
    raise SystemExit("Instale jsonschema 4.x no ambiente Python de desenvolvimento.") from exc

root = Path(__file__).resolve().parents[1]
api = json.loads((root / "contracts" / "openapi.json").read_text(encoding="utf-8"))
for schema in api["components"]["schemas"].values():
    Draft202012Validator.check_schema(schema)
schema_root = {"$schema": "https://json-schema.org/draft/2020-12/schema", "$id": "urn:hivenode:sms:contracts", **api}
registry = Registry().with_resource("urn:hivenode:sms:contracts", Resource.from_contents(schema_root))
formats = FormatChecker()

# Algumas instalações de jsonschema não trazem extras de RFC3339.
# O contrato exige timestamp com hora e timezone, mesmo nesse ambiente.
@formats.checks("date-time", raises=(ValueError, TypeError))
def valid_datetime(value):
    if not isinstance(value, str):
        return True
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})", value):
        return False
    datetime.fromisoformat(value.replace("Z", "+00:00"))
    return True

def validator(name):
    return Draft202012Validator(
        {"$ref": f"urn:hivenode:sms:contracts#/components/schemas/{name}"},
        registry=registry,
        format_checker=formats,
    )

node = "11111111-1111-4111-8111-111111111111"
sim = "22222222-2222-4222-8222-222222222222"
message = {"nodeId": node, "simBindingId": sim, "purpose": "TRANSACTIONAL", "to": "+5511999999999", "text": "Teste fictício sem modem."}
grant = {"leaseToken": "fake", "inventoryVersion": 1, "policyVersion": 1, "activeSessionId": node, "segments": 2, "previewFingerprint": "a" * 64}
event = {"eventId": node, "attemptId": sim, "deviceSequence": 1, "occurredAt": "2026-11-18T15:00:00Z"}
examples = [
    ("MessageRequest", message, True),
    ("MessageRequest", {**message, "to": "11999999999"}, False),
    ("MessageRequest", {**message, "text": ""}, False),
    ("MessageRequest", {**message, "workspaceOverride": node}, False),
    ("MessageRequest", {**message, "scheduledAt": "amanhã"}, False),
    ("ResendRequest", {"acknowledgeDuplicateRisk": True}, True),
    ("ResendRequest", {"acknowledgeDuplicateRisk": False}, False),
    ("GrantRequest", grant, True),
    ("GrantRequest", {**grant, "segments": 9}, False),
    ("GrantRequest", {k: v for k, v in grant.items() if k != "policyVersion"}, False),
    ("BatchRequest", {"nodeId": node, "simBindingId": sim, "purpose": "INTERNAL", "items": []}, False),
    ("InviteRequest", {"email": "junior@example.com", "role": "OPERATOR", "grants": []}, True),
    ("InviteRequest", {"email": "junior@example.com", "role": "OWNER", "grants": []}, False),
    ("DeviceEvents", {"events": [{"eventId": node, "eventType": "INVOKING", "attemptId": sim, "deviceSequence": 1, "occurredAt": "2026-10-13T15:00:00Z"}]}, True),
    ("DeviceEvents", {"events": [{"eventId": node, "eventType": "SEND_AGAIN_ALWAYS", "attemptId": sim, "deviceSequence": 1, "occurredAt": "2026-10-13T15:00:00Z"}]}, False),
    ("RedeemEnrollment", {"code": "a" * 32, "installationVerifier": "b" * 43, "localConfirmation": True}, True),
    ("RedeemEnrollment", {"code": "a" * 32, "installationVerifier": "b" * 43, "localConfirmation": False}, False),
    ("PolicyDecision", {"decision": "APPROVED", "reason": "Contrato revisado"}, True),
    ("PolicyDecision", {"decision": "APPROVED", "reason": ""}, False),
    ("DeviceEvent", {**event, "eventType": "SEGMENT_DELIVERED", "segmentIndex": 0, "deliveryReport": "CONFIRMED_DELIVERED"}, True),
    ("DeviceEvent", {**event, "eventType": "SEGMENT_DELIVERED", "segmentIndex": 0, "deliveryReport": "UNAVAILABLE"}, False),
    ("DeviceEvent", {**event, "eventType": "PRECHECK_FAILED"}, False),
    ("EventAcks", {"results": [{"eventId": node, "status": "RETRY"}]}, True),
]
for index, (name, payload, expected) in enumerate(examples, start=1):
    errors = list(validator(name).iter_errors(payload))
    assert (not errors) == expected, f"Exemplo {index}/{name}: esperado valido={expected}; erros={[e.message for e in errors]}"
print(json.dumps({"documentationOnly": True, "schemasChecked": len(api["components"]["schemas"]), "payloadExamplesChecked": len(examples), "errors": []}, indent=2))
