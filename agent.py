import os
import sys
import time
import uuid
import socket
import platform
import getpass
import subprocess
from datetime import datetime
from typing import List, Dict, Any, Optional
import psutil

# Conditional imports for Windows
IS_WINDOWS = platform.system() == "Windows"
if IS_WINDOWS:
    try:
        import wmi
        import win32api
        import win32con
    except ImportError:
        wmi = None

# Host backend address
API_BASE_URL = os.environ.get("SUPPORTFLOW_API_BASE_URL", "https://supportflow-1.onrender.com")
API_URL = f"{API_BASE_URL.rstrip('/')}/api/v1/agents/telemetry"
UUID_FILE = os.path.join(os.path.abspath(os.path.dirname(__file__)), ".agent_uuid")

def get_or_create_uuid() -> str:
    if os.path.exists(UUID_FILE):
        with open(UUID_FILE, "r") as f:
            return f.read().strip()
    new_id = str(uuid.uuid4())
    try:
        with open(UUID_FILE, "w") as f:
            f.write(new_id)
    except Exception:
        pass
    return new_id

def get_cpu_temp() -> Optional[float]:
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            for name, entries in temps.items():
                if entries:
                    return entries[0].current
        
        if IS_WINDOWS and wmi:
            c = wmi.WMI(namespace="root/wmi")
            zones = c.MSAcpi_ThermalZoneTemperature()
            if zones:
                temp_k = zones[0].CurrentTemperature
                return (temp_k / 10.0) - 273.15
    except Exception:
        pass
    return None

def get_ip_and_mac() -> tuple:
    ip = "127.0.0.1"
    mac = "00:00:00:00:00:00"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        try:
            ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            pass

    try:
        node = uuid.getnode()
        mac = ':'.join(('%012X' % node)[i:i+2] for i in range(0, 12, 2))
    except Exception:
        pass
    return ip, mac

def get_uptime() -> float:
    return time.time() - psutil.boot_time()

def get_running_processes() -> List[Dict[str, Any]]:
    processes = []
    try:
        for p in psutil.process_iter(attrs=['pid', 'name', 'username', 'cpu_percent', 'memory_percent']):
            try:
                info = p.info
                if info['name'].lower() in ["idle", "system idle process"]:
                    continue
                processes.append({
                    "pid": info['pid'],
                    "name": info['name'],
                    "username": info['username'] or "SYSTEM",
                    "cpu_percent": round(info['cpu_percent'] or 0.0, 1),
                    "memory_percent": round(info['memory_percent'] or 0.0, 1)
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        processes.sort(key=lambda x: x["cpu_percent"], reverse=True)
    except Exception:
        pass
    return processes[:30]

def get_services() -> List[Dict[str, Any]]:
    services = []
    try:
        if IS_WINDOWS:
            for s in psutil.win_service_iter():
                try:
                    info = s.as_dict()
                    services.append({
                        "name": info["name"],
                        "display_name": info["display_name"],
                        "status": info["status"]
                    })
                except Exception:
                    continue
        else:
            res = subprocess.run(["systemctl", "list-units", "--type=service", "--state=running", "--no-legend"], capture_output=True, text=True)
            if res.returncode == 0:
                for line in res.stdout.splitlines():
                    parts = line.split()
                    if len(parts) >= 4:
                        services.append({
                            "name": parts[0],
                            "display_name": parts[0],
                            "status": "running"
                        })
    except Exception:
        pass
    return services

def get_installed_software() -> List[Dict[str, Any]]:
    software = []
    try:
        if IS_WINDOWS:
            import winreg
            paths = [
                r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                r"SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
            ]
            for path in paths:
                try:
                    key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, path)
                    for i in range(winreg.QueryInfoKey(key)[0]):
                        try:
                            sub_key_name = winreg.EnumKey(key, i)
                            sub_key = winreg.OpenKey(key, sub_key_name)
                            try:
                                name, _ = winreg.QueryValueEx(sub_key, "DisplayName")
                                version = "Unknown"
                                publisher = "Unknown"
                                install_date = "Unknown"
                                try:
                                    version, _ = winreg.QueryValueEx(sub_key, "DisplayVersion")
                                except Exception: pass
                                try:
                                    publisher, _ = winreg.QueryValueEx(sub_key, "Publisher")
                                except Exception: pass
                                try:
                                    install_date, _ = winreg.QueryValueEx(sub_key, "InstallDate")
                                except Exception: pass
                                
                                software.append({
                                    "name": name,
                                    "version": str(version),
                                    "publisher": str(publisher),
                                    "install_date": str(install_date)
                                })
                            except FileNotFoundError:
                                continue
                            finally:
                                winreg.CloseKey(sub_key)
                        except Exception:
                            continue
                    winreg.CloseKey(key)
                except Exception:
                    continue
        else:
            res = subprocess.run(["dpkg-query", "-W", "-f=${Package};${Version};${Maintainer}\n"], capture_output=True, text=True)
            if res.returncode == 0:
                for line in res.stdout.splitlines():
                    parts = line.split(";")
                    if len(parts) >= 3:
                        software.append({
                            "name": parts[0],
                            "version": parts[1],
                            "publisher": parts[2],
                            "install_date": "N/A"
                        })
    except Exception:
        pass
    unique_sw = {sw["name"]: sw for sw in software}.values()
    return list(unique_sw)[:50]

def discover_hardware_assets() -> Dict[str, Any]:
    """
    Perform hardware checks for asset discovery logs
    """
    hw = {
        "manufacturer": "Unknown Vendor",
        "model": "Unknown Model",
        "serial_number": "Unknown Serial",
        "motherboard_serial": "Unknown Motherboard",
        "bios_version": "Unknown BIOS",
        "cpu": "Unknown CPU",
        "ram": "Unknown RAM",
        "storage": "Unknown Storage",
        "domain": "WORKGROUP",
        "type": "Desktop"
    }

    try:
        # Get RAM & disk total stats
        mem = psutil.virtual_memory()
        hw["ram"] = f"{round(mem.total / (1024**3))} GB"
        
        disk = psutil.disk_usage('/')
        hw["storage"] = f"{round(disk.total / (1024**3))} GB"

        if IS_WINDOWS:
            # Query WMI details
            hw["type"] = "Laptop" if psutil.sensors_battery() else "Desktop"
            if wmi:
                c = wmi.WMI()
                
                # Manufacturer & Model
                comp = c.Win32_ComputerSystem()
                if comp:
                    hw["manufacturer"] = comp[0].Manufacturer
                    hw["model"] = comp[0].Model
                    hw["domain"] = comp[0].Domain
                
                # Bios & Serial
                bios = c.Win32_BIOS()
                if bios:
                    hw["serial_number"] = bios[0].SerialNumber
                    hw["bios_version"] = bios[0].Name
                
                # Motherboard
                board = c.Win32_BaseBoard()
                if board:
                    hw["motherboard_serial"] = board[0].SerialNumber

                # CPU
                proc = c.Win32_Processor()
                if proc:
                    hw["cpu"] = proc[0].Name
        
        elif platform.system() == "Linux":
            hw["type"] = "Server" if not os.path.exists("/sys/class/power_supply") else "Laptop"
            # Read sysFS logs
            def read_sysfs(path: str) -> str:
                if os.path.exists(path):
                    with open(path, "r") as f:
                        return f.read().strip()
                return "Unknown"
            
            hw["manufacturer"] = read_sysfs("/sys/class/dmi/id/chassis_vendor")
            hw["model"] = read_sysfs("/sys/class/dmi/id/product_name")
            hw["serial_number"] = read_sysfs("/sys/class/dmi/id/product_serial")
            hw["motherboard_serial"] = read_sysfs("/sys/class/dmi/id/board_serial")
            hw["bios_version"] = read_sysfs("/sys/class/dmi/id/bios_version")
            
            # Read CPU
            with open("/proc/cpuinfo", "r") as f:
                for line in f:
                    if "model name" in line:
                        hw["cpu"] = line.split(":", 1)[1].strip()
                        break
        
        elif platform.system() == "Darwin":
            hw["type"] = "Laptop" if "macbook" in hw["model"].lower() else "Workstation"
            # Read system profile
            try:
                res = subprocess.run(["system_profiler", "SPHardwareDataType"], capture_output=True, text=True)
                for line in res.stdout.splitlines():
                    if "Model Identifier" in line:
                        hw["model"] = line.split(":", 1)[1].strip()
                    elif "Serial Number" in line:
                        hw["serial_number"] = line.split(":", 1)[1].strip()
                    elif "Hardware UUID" in line:
                        hw["motherboard_serial"] = line.split(":", 1)[1].strip()
                
                cpu_res = subprocess.run(["sysctl", "-n", "machdep.cpu.brand_string"], capture_output=True, text=True)
                hw["cpu"] = cpu_res.stdout.strip()
            except Exception:
                pass
                
    except Exception as e:
        print(f"Error executing hardware asset discovery: {e}")

    return hw

def collect_telemetry() -> Dict[str, Any]:
    cpu = psutil.cpu_percent(interval=0.5)
    ram = psutil.virtual_memory().percent
    disk = psutil.disk_usage('/')
    disk_free = disk.free / (1024 ** 3)
    ip, mac = get_ip_and_mac()
    
    # Run hardware checks
    hw = discover_hardware_assets()
    
    payload = {
        "device_uuid": get_or_create_uuid(),
        "uuid": get_or_create_uuid(),
        "hostname": socket.gethostname(),
        "ip_address": ip,
        "mac_address": mac,
        "operating_system": platform.system(),
        "os": platform.system(),
        "kernel": platform.release(),
        "username": getpass.getuser(),
        "current_user": getpass.getuser(),
        "uptime": round(get_uptime(), 1),
        "cpu_usage": cpu,
        "ram_usage": ram,
        "disk_usage": disk.percent,
        "disk_free_gb": round(disk_free, 2),
        "cpu_temp": get_cpu_temp(),
        "processes": get_running_processes(),
        "services": get_services(),
        "software": get_installed_software(),
        "network_interfaces": [{"interface": k, "bytes_sent": v.bytes_sent, "bytes_recv": v.bytes_recv} for k, v in psutil.net_io_counters(pernic=True).items()][:5],
        "docker_containers": []
    }
    
    # Merge hardware profiles
    payload.update(hw)
    return payload

def main():
    import urllib.request
    import json

    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] SupportFlow Endpoint Monitoring Agent started.")
    print(f"Agent Device UUID: {get_or_create_uuid()}")
    print(f"Target API Base URL: {API_BASE_URL}")
    print(f"Target Endpoint URL: {API_URL}")
    print("Collecting telemetry data and syncing to backend server...")
    
    while True:
        try:
            payload = collect_telemetry()
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Telemetry collected successfully: CPU={payload['cpu_usage']}%, RAM={payload['ram_usage']}%, processes={len(payload['processes'])} active.")
            
            req = urllib.request.Request(
                API_URL, 
                data=json.dumps(payload).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'SupportFlowAgent/1.0'
                }
            )
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Attempting sync to {API_URL}...")
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    resp_data = response.read().decode('utf-8')
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Telemetry payload successfully synced. Server response: {resp_data}")
                else:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] WARNING: Backend returned non-200 status code: {response.status}")
        except urllib.error.HTTPError as he:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] HTTP ERROR: Sync failed with status code {he.code}: {he.reason}. Response details: {he.read().decode('utf-8', errors='ignore')}")
        except urllib.error.URLError as ue:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] CONNECTION FAILED: Unable to reach backend (URL: {API_URL}). Reason: {ue.reason}. Re-attempting sync in 15 seconds...")
        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] UNEXPECTED ERROR: {e}")
            
        time.sleep(15)

if __name__ == "__main__":
    main()
