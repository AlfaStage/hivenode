package auth

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
)

// SignWSURL produz a query string de assinatura para conectar ao broker.
// nodeId é o ID do device (vem do /api/nodes/register quando o usuário vincula aparelho).
// secret é "hivenode_secret_key" hoje (hardcoded no broker) OU o tunnelSecret
// por-usuario após Sprint 3 S1 (ver .explicações/melhorias-glm-5.2/03-sprint-seguranca-critica.md).
//
// broker Go define o secret em websocket.go:215.
// Após Sprint 3 S1: broker Go busca em Redis user_tunnel_secret:{nodeId}.
// Client não muda - só precisamos receber o secret do Java caller.
func BuildSig(nodeID string, secret []byte) string {
    mac := hmac.New(sha256.New, secret)
    mac.Write([]byte(nodeID))
    return hex.EncodeToString(mac.Sum(nil))
}
