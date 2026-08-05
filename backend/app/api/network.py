from fastapi import APIRouter, Depends, Query
from typing import List, Dict, Any

from app.schemas.system import PingResult, TracerouteResult, DnsLookupResult, LanDevice
from app.services import network_diag
from app.core.dependencies import get_current_active_user

router = APIRouter()

@router.get("/ping", response_model=PingResult)
def ping_host(
    host: str = Query(..., description="Target hostname or IP address"),
    count: int = Query(4, ge=1, le=10),
    current_user=Depends(get_current_active_user)
):
    return network_diag.execute_ping(host, count)

@router.get("/traceroute", response_model=TracerouteResult)
def trace_route(
    host: str = Query(..., description="Target hostname or IP address"),
    current_user=Depends(get_current_active_user)
):
    return network_diag.execute_traceroute(host)

@router.get("/dns", response_model=DnsLookupResult)
def dns_lookup(
    host: str = Query(..., description="Hostname to resolve"),
    current_user=Depends(get_current_active_user)
):
    return network_diag.execute_dns_lookup(host)

@router.post("/scan", response_model=List[LanDevice])
def scan_lan(
    limit: int = Query(50, ge=1, le=254, description="Number of IPs in subnet to scan"),
    current_user=Depends(get_current_active_user)
):
    return network_diag.scan_local_network(limit)
