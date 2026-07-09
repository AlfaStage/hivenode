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

// ValidateSOCKS5User verifica no Redis (onde a Web API guardou o hash)
// e retorna o ID do Node (Device Android) associado a esse proxyUser.
func (c *Client) ValidateSOCKS5User(ctx context.Context, username, password string) (string, error) {
	val, err := c.Get(ctx, "proxy:"+username).Result()
	if err != nil {
		if err == goredis.Nil {
			return "", fmt.Errorf("usuário de proxy não encontrado")
		}
		return "", err
	}

	parts := strings.Split(val, ":")
	if len(parts) != 2 {
		return "", fmt.Errorf("credencial inválida no redis")
	}

	nodeId := parts[0]
	expectedPass := parts[1]

	if password != expectedPass {
		return "", fmt.Errorf("senha do proxy incorreta")
	}

	log.Printf("✅ Proxy Autenticado [%s] -> Roteando para Celular [%s]", username, nodeId)
	return nodeId, nil
}
