from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class CpuMetrics(BaseModel):
    usage_percent: float
    frequency_mhz: float
    cores_physical: int
    cores_logical: int
    temperature: Optional[float] = None

class RamMetrics(BaseModel):
    total_gb: float
    used_gb: float
    free_gb: float
    percent: float

class DiskMetrics(BaseModel):
    total_gb: float
    used_gb: float
    free_gb: float
    percent: float
    device: str

class ServiceInfo(BaseModel):
    name: str
    display_name: str
    status: str  # Running, Stopped, Paused, etc.
    start_type: Optional[str] = None

class ProcessInfo(BaseModel):
    pid: int
    name: str
    cpu_percent: float
    memory_percent: float
    status: str
    username: Optional[str] = None

class SystemSpecs(BaseModel):
    hostname: str
    os_name: str
    os_version: str
    os_build: str
    processor: str
    ram_gb: float
    mac_address: str
    ip_address: str
    uptime_seconds: float
    current_user: str
    motherboard: str
    bios_version: str

class SystemMetricsResponse(BaseModel):
    cpu: CpuMetrics
    ram: RamMetrics
    disks: List[DiskMetrics]
    network_sent_mbs: float
    network_recv_mbs: float
    defender_status: str
    firewall_status: str
    internet_status: bool
    services_running_count: int
    open_tickets_count: int
    resolved_tickets_count: int
    critical_alerts_count: int
    health_score: int

class PingResult(BaseModel):
    host: str
    packets_sent: int
    packets_received: int
    packet_loss_percent: float
    min_rtt_ms: Optional[float] = None
    avg_rtt_ms: Optional[float] = None
    max_rtt_ms: Optional[float] = None
    status: str  # Online, Offline
    output: str

class TracerouteHop(BaseModel):
    hop_number: int
    rtt_ms: str
    ip_address: str
    hostname: str

class TracerouteResult(BaseModel):
    host: str
    hops: List[TracerouteHop]
    output: str

class DnsLookupResult(BaseModel):
    host: str
    ip_addresses: List[str]
    query_time_ms: float
    status: str

class LanDevice(BaseModel):
    ip: str
    mac: str
    hostname: str
    latency_ms: Optional[float] = None
    status: str  # Online, Offline

class SoftwareItem(BaseModel):
    name: str
    version: Optional[str] = None
    publisher: Optional[str] = None
    install_date: Optional[str] = None

class DiagnosticsResult(BaseModel):
    health_score: int
    cpu_health: str  # Good, Fair, Critical
    ram_health: str
    disk_health: str
    internet_health: str
    dns_health: str
    gateway_health: str
    firewall_health: str
    defender_health: str
    updates_health: str
    cleanup_recommendation_gb: float
    startup_programs: List[str]
    recommendations: List[str]
