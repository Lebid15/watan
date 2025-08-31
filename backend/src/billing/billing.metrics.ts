// Simple in-memory metrics registry (Prometheus style exposition rendered in metrics.controller)
// Avoid adding heavy client library; minimal counters/gauges/histogram buckets.
export interface Histogram { observe(v: number): void; buckets: number[]; counts: number[]; sum: number; }

class MetricsRegistry {
  counters: Record<string, number> = Object.create(null);
  gauges: Record<string, number> = Object.create(null);
  histogramStore: Record<string, Histogram> = Object.create(null);

  counter(name: string) { if (!(name in this.counters)) this.counters[name] = 0; return { inc: (v=1)=> { this.counters[name]+=v; } }; }
  gauge(name: string) { if (!(name in this.gauges)) this.gauges[name] = 0; return { set: (v: number)=> { this.gauges[name]=v; } }; }
  histogram(name: string, buckets: number[] = [0.05,0.1,0.25,0.5,1,2,5,10,30,60]) {
    if (!(name in this.histogramStore)) {
      this.histogramStore[name] = {
        buckets: buckets.slice().sort((a,b)=>a-b),
        counts: new Array(buckets.length+1).fill(0), // +Inf bucket
        sum: 0,
        observe: (v: number)=>{
          const h = this.histogramStore[name];
          h.sum += v;
          let placed = false;
          for (let i=0;i<h.buckets.length;i++) { if (v <= h.buckets[i]) { h.counts[i]++; placed = true; break; } }
          if (!placed) h.counts[h.counts.length-1]++;
        },
      } as any;
    }
    return this.histogramStore[name];
  }
}

export const metricsRegistry = new MetricsRegistry();

// Exposed helpers used by service/schedulers
export const billingCounters = {
  invoicesCreated: () => metricsRegistry.counter('billing_invoices_created_total').inc(),
  enforcementSuspended: () => metricsRegistry.counter('billing_enforcement_suspended_total').inc(),
  paymentDeposits: () => metricsRegistry.counter('billing_payment_deposits_total').inc(),
};

export const billingGauges = {
  openInvoices: (v: number) => metricsRegistry.gauge('billing_open_invoices').set(v),
  suspendedTenants: (v: number) => metricsRegistry.gauge('billing_suspended_tenants').set(v),
};

export function observeJobDuration(job: string, seconds: number) {
  metricsRegistry.histogram('billing_job_duration_seconds').observe(seconds);
  metricsRegistry.histogram(`billing_job_duration_seconds_${job}`).observe(seconds);
}
