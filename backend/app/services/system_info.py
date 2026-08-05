import os
import sys
import platform
import socket
import time
import subprocess
from datetime import datetime
from typing import List, Dict, Any, Optional

import psutil

# Windows-only modules
IS_WINDOWS = sys.platform == 'win32'

if IS_WINDOWS:
    import winreg
    try:
        import wmi
    except ImportError:
        wmi = None
else:
    wmi = None

def get_uptime() -> float:
    return time.time() - psutil.boot_time()

def get_cpu_info() -> Dict[str, Any]:
    freq = psutil.cpu_freq()
    return {
        "usage_percent": psutil.cpu_percent(interval=None),
        "frequency_mhz": freq.current if freq else 0.0,
        "cores_physical": psutil.cpu_count(logical=False) or 0,
        "cores_logical": psutil.cpu_count(logical=True) or 0,
        "temperature": get_cpu_temperature()
    }

def get_cpu_temperature() -> Optional[float]:
    if not IS_WINDOWS:
        # Linux fallback
        try:
            temps = psutil.sensors_temperatures()
            if 'coretemp' in temps:
                return temps['coretemp'][0].current
        except Exception:
            pass
        return None

    # Windows thermal zone query via WMI
    if wmi:
        try:
            w = wmi.WMI(namespace="root/WMI")
            # MSAcpi_ThermalZoneTemperature gives temperature in tenths of Kelvin
            zones = w.MSAcpi_ThermalZoneTemperature()
            if zones:
                # Take the first zone
                kelvin_tenths = zones[0].CurrentTemperature
                celsius = (kelvin_tenths / 10.0) - 273.15
                return round(celsius, 2)
        except Exception:
            pass
    return None

def get_ram_info() -> Dict[str, Any]:
    vm = psutil.virtual_memory()
    return {
        "total_gb": round(vm.total / (1024 ** 3), 2),
        "used_gb": round(vm.used / (1024 ** 3), 2),
        "free_gb": round(vm.available / (1024 ** 3), 2),
        "percent": vm.percent
    }

def get_disk_info() -> List[Dict[str, Any]]:
    disk_list = []
    try:
        for partition in psutil.disk_partitions(all=False):
            if partition.fstype == "":
                continue
            # Filter CD-ROMs or virtual loops
            if 'cdrom' in partition.opts or partition.mountpoint.startswith('/snap'):
                continue
            try:
                usage = psutil.disk_usage(partition.mountpoint)
                disk_list.append({
                    "device": partition.device,
                    "total_gb": round(usage.total / (1024 ** 3), 2),
                    "used_gb": round(usage.used / (1024 ** 3), 2),
                    "free_gb": round(usage.free / (1024 ** 3), 2),
                    "percent": usage.percent
                })
            except Exception:
                continue
    except Exception:
        # Simple fallback
        pass
    if not disk_list:
        # Standard root check
        try:
            usage = psutil.disk_usage('/')
            disk_list.append({
                "device": "/",
                "total_gb": round(usage.total / (1024 ** 3), 2),
                "used_gb": round(usage.used / (1024 ** 3), 2),
                "free_gb": round(usage.free / (1024 ** 3), 2),
                "percent": usage.percent
            })
        except Exception:
            pass
    return disk_list

def get_windows_services() -> List[Dict[str, Any]]:
    services = []
    if not IS_WINDOWS:
        return services
    
    try:
        for service in psutil.win_service_iter():
            try:
                info = service.as_dict()
                services.append({
                    "name": info.get("name", ""),
                    "display_name": info.get("display_name", ""),
                    "status": info.get("status", ""),
                    "start_type": info.get("start_type", "")
                })
            except Exception:
                continue
    except Exception:
        pass
    return sorted(services, key=lambda s: s["display_name"].lower())

def control_windows_service(service_name: str, action: str) -> bool:
    if not IS_WINDOWS:
        return False
    try:
        # actions: start, stop, restart
        # Requires admin rights
        cmd = ["powershell", "-Command", f"{action}-Service -Name '{service_name}'"]
        if action == "restart":
            cmd = ["powershell", "-Command", f"Restart-Service -Name '{service_name}'"]
        
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return res.returncode == 0
    except Exception:
        return False

def get_running_processes() -> List[Dict[str, Any]]:
    processes = []
    # Collect top 20 processes by memory or CPU usage
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'status', 'username']):
        try:
            info = proc.info
            processes.append({
                "pid": info['pid'],
                "name": info['name'] or "Unknown",
                "cpu_percent": round(info['cpu_percent'] or 0.0, 1),
                "memory_percent": round(info['memory_percent'] or 0.0, 2),
                "status": info['status'] or "Running",
                "username": info['username'] or "SYSTEM"
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
    # Sort by cpu usage first, memory second
    processes.sort(key=lambda p: (p['cpu_percent'], p['memory_percent']), reverse=True)
    return processes[:50]

def get_system_specs() -> Dict[str, Any]:
    hostname = socket.gethostname()
    ip_address = "127.0.0.1"
    try:
        # Get primary IP address
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip_address = s.getsockname()[0]
        s.close()
    except Exception:
        try:
            ip_address = socket.gethostbyname(hostname)
        except Exception:
            pass

    mac_address = "00:00:00:00:00:00"
    try:
        from uuid import getnode
        mac = getnode()
        mac_address = ':'.join(("%012X" % mac)[i:i+2] for i in range(0, 12, 2))
    except Exception:
        pass

    current_user = "Unknown"
    try:
        current_user = os.getlogin()
    except Exception:
        try:
            import getpass
            current_user = getpass.getuser()
        except Exception:
            pass

    # Windows registry/WMI specific properties
    os_name = platform.system()
    os_version = platform.release()
    os_build = platform.version()
    processor = platform.processor()
    bios_version = "Unknown"
    motherboard = "Unknown"

    if IS_WINDOWS and wmi:
        try:
            w = wmi.WMI()
            # OS details
            for os_info in w.Win32_OperatingSystem():
                os_name = os_info.Caption
                os_version = os_info.Version
                os_build = os_info.BuildNumber
            
            # BIOS details
            for bios in w.Win32_BIOS():
                bios_version = f"{bios.Manufacturer} {bios.Version}"
            
            # Motherboard details
            for board in w.Win32_BaseBoard():
                motherboard = f"{board.Manufacturer} {board.Product}"
                
            # Processor details
            for cpu in w.Win32_Processor():
                processor = cpu.Name.strip()
        except Exception:
            pass

    # RAM total
    vm = psutil.virtual_memory()
    ram_gb = round(vm.total / (1024 ** 3), 2)

    return {
        "hostname": hostname,
        "os_name": os_name,
        "os_version": os_version,
        "os_build": os_build,
        "processor": processor,
        "ram_gb": ram_gb,
        "mac_address": mac_address,
        "ip_address": ip_address,
        "uptime_seconds": round(get_uptime()),
        "current_user": current_user,
        "motherboard": motherboard,
        "bios_version": bios_version
    }

def get_installed_software() -> List[Dict[str, Any]]:
    software_list = []
    if not IS_WINDOWS:
        return [{"name": "Mock Editor X", "version": "1.0", "publisher": "HelpDesk X Devs", "install_date": "2026-08-01"}]

    reg_paths = [
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Uninstall")
    ]

    seen = set()

    for hkey, subkey in reg_paths:
        try:
            key = winreg.OpenKey(hkey, subkey)
            for i in range(winreg.QueryInfoKey(key)[0]):
                try:
                    name = winreg.EnumKey(key, i)
                    sub = winreg.OpenKey(key, name)
                    try:
                        disp_name, _ = winreg.QueryValueEx(sub, "DisplayName")
                        if not disp_name or disp_name in seen:
                            continue
                        seen.add(disp_name)
                        
                        version = None
                        publisher = None
                        inst_date = None
                        
                        try:
                            version, _ = winreg.QueryValueEx(sub, "DisplayVersion")
                        except Exception:
                            pass
                        
                        try:
                            publisher, _ = winreg.QueryValueEx(sub, "Publisher")
                        except Exception:
                            pass
                        
                        try:
                            inst_date, _ = winreg.QueryValueEx(sub, "InstallDate")
                        except Exception:
                            pass

                        software_list.append({
                            "name": str(disp_name),
                            "version": str(version) if version else None,
                            "publisher": str(publisher) if publisher else None,
                            "install_date": str(inst_date) if inst_date else None
                        })
                    except Exception:
                        pass
                    finally:
                        sub.Close()
                except Exception:
                    continue
            key.Close()
        except Exception:
            continue

    return sorted(software_list, key=lambda s: s["name"].lower())

def get_startup_programs() -> List[str]:
    startup = []
    if not IS_WINDOWS:
        return ["MockStartupTask"]

    reg_paths = [
        (winreg.HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Run"),
        (winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run")
    ]

    for hkey, subkey in reg_paths:
        try:
            key = winreg.OpenKey(hkey, subkey)
            for i in range(winreg.QueryInfoKey(key)[1]):
                try:
                    val_name, _, _ = winreg.EnumValue(key, i)
                    if val_name:
                        startup.append(val_name)
                except Exception:
                    continue
            key.Close()
        except Exception:
            continue
            
    return list(set(startup))

def get_firewall_status() -> str:
    if not IS_WINDOWS:
        return "Disabled"
    try:
        # Run netsh to check firewall state
        res = subprocess.run(["netsh", "advfirewall", "show", "allprofiles", "state"], capture_output=True, text=True)
        if "ON" in res.stdout:
            return "Enabled"
        return "Disabled"
    except Exception:
        return "Unknown"

def get_defender_status() -> str:
    if not IS_WINDOWS:
        return "Disabled"
    try:
        # Run powershell query for Defender
        cmd = ["powershell", "-Command", "Get-MpComputerStatus | Select-Object -ExpandProperty RealTimeProtectionEnabled"]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        if "True" in res.stdout:
            return "Enabled"
        # Secondary check: search running processes for msmpeng.exe
        for proc in psutil.process_iter(['name']):
            if proc.info['name'] and proc.info['name'].lower() == 'msmpeng.exe':
                return "Enabled"
        return "Disabled"
    except Exception:
        return "Disabled"

def check_internet_status() -> bool:
    try:
        # Attempt to resolve Google DNS and open a socket
        socket.setdefaulttimeout(3)
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(("8.8.8.8", 53))
        s.close()
        return True
    except Exception:
        return False
