package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	RedisURL         string
	Socks5Port       string
	TunnelPort       string
	BillingFlushMB   int
	BillingFlushSecs int
	JWTSecret        string
}

// Load lê as variáveis de ambiente e retorna a configuração.
func Load() *Config {
	// Tenta carregar do .env caso esteja rodando local sem docker
	if err := godotenv.Load("../../.env"); err != nil {
		log.Println("Aviso: Arquivo .env não encontrado, usando variáveis de ambiente do sistema")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatalf("JWT_SECRET não configurada")
	}

	return &Config{
		RedisURL:         getEnv("REDIS_URL", "redis://localhost:6379/0"),
		Socks5Port:       getEnv("SOCKS5_PORT", "10000"),
		TunnelPort:       getEnv("TUNNEL_PORT", "10001"),
		BillingFlushMB:   5, // Hardcoded por segurança nesta fase
		BillingFlushSecs: 30,
		JWTSecret:        jwtSecret,
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
