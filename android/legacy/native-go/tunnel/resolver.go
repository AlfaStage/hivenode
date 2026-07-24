package tunnel

import (
    "net"
    "sync"
    "sync/atomic"
    "time"
)

// Em Android antigo, cada dial TCP faz DNS resolve de novo. No 3G isso é caro.
// Cache LRU simples com TTL 5 min e 100 entradas.

type dnsCacheEntry struct {
    ips       []net.IP
    expiresAt time.Time
}

type DNSCache struct {
    mu     sync.Mutex
    cache  map[string]dnsCacheEntry
    hits   uint64
    misses uint64
}

func NewDNSCache() *DNSCache {
    return &DNSCache{cache: make(map[string]dnsCacheEntry)}
}

// Resolve tenta cache; cai p/ net.LookupIP.
func (d *DNSCache) Resolve(host string) ([]net.IP, error) {
    d.mu.Lock()
    if e, ok := d.cache[host]; ok && time.Now().Before(e.expiresAt) {
        atomic.AddUint64(&d.hits, 1)
        d.mu.Unlock()
        return e.ips, nil
    }
    d.mu.Unlock()

    atomic.AddUint64(&d.misses, 1)
    ips, err := net.LookupIP(host)
    if err != nil {
        return nil, err
    }

    d.mu.Lock()
    // Evict oldest se cache > 100
    if len(d.cache) > 100 {
        for k := range d.cache {
            delete(d.cache, k)
            break
        }
    }
    d.cache[host] = dnsCacheEntry{
        ips:       ips,
        expiresAt: time.Now().Add(5 * time.Minute),
    }
    d.mu.Unlock()
    return ips, nil
}

// Stats retorna hits/misses p/ Telemetry.
func (d *DNSCache) Stats() (uint64, uint64) {
    return atomic.LoadUint64(&d.hits), atomic.LoadUint64(&d.misses)
}
