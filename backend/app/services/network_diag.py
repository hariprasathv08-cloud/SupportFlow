import sys
import socket
import subprocess
import time
import re
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor

IS_WINDOWS = sys.platform == 'win32'

def execute_ping(host: str, count: int = 4) -> Dict[str, Any]:
    if IS_WINDOWS:
        cmd = ["ping", "-n", str(count), host]
    else:
        cmd = ["ping", "-c", str(count), host]

    start_time = time.time()
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        output = res.stdout
    except subprocess.TimeoutExpired:
        return {
            "host": host,
            "packets_sent": count,
            "packets_received": 0,
            "packet_loss_percent": 100.0,
            "min_rtt_ms": None,
            "avg_rtt_ms": None,
            "max_rtt_ms": None,
            "status": "Offline",
            "output": "Ping query timed out."
        }

    # Parser definitions
    packets_sent = count
    packets_received = 0
    packet_loss_percent = 100.0
    min_rtt = None
    avg_rtt = None
    max_rtt = None

    if IS_WINDOWS:
        # Look for sent/received
        sent_recv_match = re.search(r"Sent = (\d+), Received = (\d+), Lost = (\d+)", output)
        if sent_recv_match:
            packets_sent = int(sent_recv_match.group(1))
            packets_received = int(sent_recv_match.group(2))
            packet_loss_percent = (packets_sent - packets_received) / packets_sent * 100.0
        
        # Look for min/avg/max
        rtt_match = re.search(r"Minimum = (\d+)ms, Maximum = (\d+)ms, Average = (\d+)ms", output)
        if rtt_match:
            min_rtt = float(rtt_match.group(1))
            max_rtt = float(rtt_match.group(2))
            avg_rtt = float(rtt_match.group(3))
    else:
        # Linux parser
        sent_recv_match = re.search(r"(\d+) packets transmitted, (\d+) received, (\d+)% packet loss", output)
        if sent_recv_match:
            packets_sent = int(sent_recv_match.group(1))
            packets_received = int(sent_recv_match.group(2))
            packet_loss_percent = float(sent_recv_match.group(3))
        
        rtt_match = re.search(r"rtt min/avg/max/mdev = ([\d\.]+)/([\d\.]+)/([\d\.]+)/", output)
        if rtt_match:
            min_rtt = float(rtt_match.group(1))
            avg_rtt = float(rtt_match.group(2))
            max_rtt = float(rtt_match.group(3))

    status = "Online" if packets_received > 0 else "Offline"

    return {
        "host": host,
        "packets_sent": packets_sent,
        "packets_received": packets_received,
        "packet_loss_percent": round(packet_loss_percent, 1),
        "min_rtt_ms": min_rtt,
        "avg_rtt_ms": avg_rtt,
        "max_rtt_ms": max_rtt,
        "status": status,
        "output": output
    }

def execute_traceroute(host: str) -> Dict[str, Any]:
    if IS_WINDOWS:
        cmd = ["tracert", "-d", "-h", "15", host]  # 15 hops max for speed
    else:
        cmd = ["traceroute", "-n", "-m", "15", host]

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        output = res.stdout
    except subprocess.TimeoutExpired:
        return {
            "host": host,
            "hops": [],
            "output": "Traceroute timed out."
        }

    hops = []
    lines = output.splitlines()

    for line in lines:
        line = line.strip()
        # Parse hops
        if IS_WINDOWS:
            # Format:  1    <1 ms    <1 ms    <1 ms  192.168.1.1
            match = re.match(r"^\s*(\d+)\s+((?:<\s*)?\d+\s*ms|\*)\s+((?:<\s*)?\d+\s*ms|\*)\s+((?:<\s*)?\d+\s*ms|\*)\s+(.+)$", line)
            if match:
                hop_num = int(match.group(1))
                ip = match.group(5).strip()
                # Use average / formatted times
                times = f"{match.group(2).strip()} | {match.group(3).strip()} | {match.group(4).strip()}"
                
                # Resolve name
                name = "Unknown"
                if "request timed out" in ip.lower():
                    ip = "*"
                    name = "Request timed out."
                elif "[" in ip and "]" in ip:
                    ip_match = re.search(r"\[([\d\.\:]+)\]", ip)
                    if ip_match:
                        name = ip.split("[")[0].strip()
                        ip = ip_match.group(1)
                else:
                    name = ip
                    if ip != "*" and not re.match(r"^\*$", ip):
                        try:
                            name = socket.gethostbyaddr(ip)[0]
                        except Exception:
                            name = ip
                
                hops.append({
                    "hop_number": hop_num,
                    "rtt_ms": times,
                    "ip_address": ip,
                    "hostname": name
                })
        else:
            # Linux: 1  192.168.1.1  0.421 ms
            match = re.match(r"^\s*(\d+)\s+([\d\.\:]+|[\w\.\-]+|\*)\s+([\d\.]+)\s*ms", line)
            if match:
                hop_num = int(match.group(1))
                ip = match.group(2)
                rtt = f"{match.group(3)} ms"
                try:
                    name = socket.gethostbyaddr(ip)[0]
                except Exception:
                    name = ip
                hops.append({
                    "hop_number": hop_num,
                    "rtt_ms": rtt,
                    "ip_address": ip,
                    "hostname": name
                })

    return {
        "host": host,
        "hops": hops,
        "output": output
    }

def execute_dns_lookup(host: str) -> Dict[str, Any]:
    start_time = time.time()
    try:
        query_time = 0.0
        # Resolve hostname
        ips = socket.gethostbyname_ex(host)[2]
        query_time = round((time.time() - start_time) * 1000, 2)
        return {
            "host": host,
            "ip_addresses": ips,
            "query_time_ms": query_time,
            "status": "Success"
        }
    except Exception as e:
        return {
            "host": host,
            "ip_addresses": [],
            "query_time_ms": round((time.time() - start_time) * 1000, 2),
            "status": f"Failed ({e})"
        }

def get_primary_subnet() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        # Get /24 subnet prefix e.g., 192.168.1.
        parts = ip.split('.')
        if len(parts) == 4:
            return f"{parts[0]}.{parts[1]}.{parts[2]}."
    except Exception:
        pass
    return "192.168.1."

def ping_single_ip(ip: str) -> Optional[Dict[str, Any]]:
    # fast single ping
    if IS_WINDOWS:
        cmd = ["ping", "-n", "1", "-w", "800", ip]
    else:
        cmd = ["ping", "-c", "1", "-W", "1", ip]
    
    start_time = time.time()
    try:
        res = subprocess.run(cmd, capture_output=True, text=True)
        rtt = round((time.time() - start_time) * 1000, 1)
        if res.returncode == 0 or (not IS_WINDOWS and "1 received" in res.stdout) or (IS_WINDOWS and "Received = 1" in res.stdout):
            # Resolve hostname
            try:
                hostname = socket.gethostbyaddr(ip)[0]
            except Exception:
                hostname = "Unknown"
            
            # Resolve MAC (optional, try to run ARP lookup)
            mac = get_mac_from_arp(ip)
            return {
                "ip": ip,
                "mac": mac,
                "hostname": hostname,
                "latency_ms": rtt,
                "status": "Online"
            }
    except Exception:
        pass
    return None

def get_mac_from_arp(ip: str) -> str:
    try:
        res = subprocess.run(["arp", "-a", ip], capture_output=True, text=True)
        # Parse MAC e.g. 00-11-22-33-44-55
        match = re.search(r"([0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2})", res.stdout)
        if match:
            return match.group(1).replace('-', ':').upper()
    except Exception:
        pass
    return "00:00:00:00:00:00"

def scan_local_network(limit: int = 50) -> List[Dict[str, Any]]:
    subnet_prefix = get_primary_subnet()
    ips_to_scan = [f"{subnet_prefix}{i}" for i in range(1, limit + 1)]
    
    online_devices = []
    # Fast multi-threaded ping sweep
    with ThreadPoolExecutor(max_workers=30) as executor:
        results = executor.map(ping_single_ip, ips_to_scan)
        for r in results:
            if r:
                online_devices.append(r)
                
    return online_devices
