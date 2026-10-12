package stats

import "sync/atomic"

type Counter struct {
    rx uint64
    tx uint64
}

func NewCounter() *Counter { return &Counter{} }

func (c *Counter) AddRx(n int) { atomic.AddUint64(&c.rx, uint64(n)) }
func (c *Counter) AddTx(n int) { atomic.AddUint64(&c.tx, uint64(n)) }

func (c *Counter) Rx() uint64 { return atomic.LoadUint64(&c.rx) }
func (c *Counter) Tx() uint64 { return atomic.LoadUint64(&c.tx) }
