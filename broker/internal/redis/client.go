package redis

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

type Client struct {
	*goredis.Client
}

// NewClient conecta ao Redis.
func NewClient(url string) (*Client, error) {
	opts, err := goredis.ParseURL(url)
	if err != nil {
		return nil, err
	}

	client := goredis.NewClient(opts)

	// Testa a conexão
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	log.Println("✅ Conectado ao Redis com sucesso")
	return &Client{client}, nil
}

func (c *Client) ValidateSOCKS5User(ctx context.Context, username, password string) (string, string, error) {
	// 1. Rate Limiting Básico (Prevenção de Brute Force)
	rlKey := "ratelimit:socks5:" + username
	attempts, err := c.Incr(ctx, rlKey).Result()
	if err == nil && attempts == 1 {
		c.Expire(ctx, rlKey, 15*time.Minute)
	}
	if attempts > 5 {
		return "", "", fmt.Errorf("rate limit excedido para o usuário %s", username)
	}

	// 2. Busca credencial no Redis
	val, err := c.Get(ctx, "proxy:"+username).Result()
	if err != nil {
		if err == goredis.Nil {
			return "", "", fmt.Errorf("usuário de proxy não encontrado")
		}
		return "", "", err
	}

	parts := strings.Split(val, ":")
	if len(parts) < 2 {
		return "", "", fmt.Errorf("credencial inválida no redis")
	}

	nodeId := parts[0]
	expectedPass := parts[1]
	nodeType := "PRIVATE"
	if len(parts) == 3 {
		nodeType = parts[2] // Ex: nodeId:senha:PUBLIC
	}

	if password != expectedPass {
		return "", "", fmt.Errorf("senha do proxy incorreta")
	}

	// Sucesso na autenticação: limpa o rate limit
	c.Del(ctx, rlKey)

	log.Printf("✅ Proxy Autenticado [%s] -> Roteando para [%s] Tipo: %s", username, nodeId, nodeType)
	return nodeId, nodeType, nil
}
