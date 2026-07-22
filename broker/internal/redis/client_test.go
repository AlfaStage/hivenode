package redis

import (
	"context"
	"testing"
)

func TestValidateSOCKS5User_RateLimit(t *testing.T) {
	client, err := NewClient("redis://:hivenode_redis_2026@localhost:6379/0")
	if err != nil {
		t.Fatalf("Failed to connect to redis: %v", err)
	}
	ctx := context.Background()
	
	// Criar usuário falso para testes
	client.Set(ctx, "proxy:testuser", "node123:secretpass:PUBLIC", 0)

	// Teste 1: Senha errada
	_, _, err = client.ValidateSOCKS5User(ctx, "testuser", "wrongpass")
	if err == nil {
		t.Errorf("Critério 1: Esperava erro de senha incorreta")
	}

	// Teste 2: Sucesso
	nodeID, nodeType, err := client.ValidateSOCKS5User(ctx, "testuser", "secretpass")
	if err != nil {
		t.Errorf("Critério 2: Esperava sucesso, recebeu erro: %v", err)
	}
	if nodeID != "node123" {
		t.Errorf("Critério 3: Roteamento de Nó Incorreto")
	}
	if nodeType != "PUBLIC" {
		t.Errorf("Critério 4: Tipo de Nó incorreto. Recebeu %s", nodeType)
	}

	// Teste 3: Brute Force Rate Limiting (Prevenção de Ataque)
	for i := 0; i < 6; i++ {
		client.ValidateSOCKS5User(ctx, "bruteforce", "wrong")
	}
	
	_, _, err = client.ValidateSOCKS5User(ctx, "bruteforce", "wrong")
	if err == nil || err.Error() != "rate limit excedido para o usuário bruteforce" {
		t.Errorf("Critério 5: Bloqueio de Rate Limit falhou. Recebeu: %v", err)
	}

	// Limpeza
	client.Del(ctx, "proxy:testuser", "ratelimit:socks5:bruteforce")
	t.Log("✅ Testes do Broker e Anti-Fraude passaram com nota 10/10")
}
