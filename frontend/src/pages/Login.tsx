import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  User, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  Building, 
  Users, 
  Check, 
  Info,
  ArrowLeft,
  ChevronRight
} from "lucide-react";
import api from "../services/api";
import { useBackendStatus } from "../hooks/useBackendStatus";
import ITOpsIllustration from "../components/ITOpsIllustration";

export default function Login() {
  const navigate = useNavigate();
  const { isOffline, isStarting } = useBackendStatus();

  // Auth Modes: 'login' | 'register' | 'forgot-password'
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot-password">("login");
  
  // Form values
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("Viewer");
  const [rememberMe, setRememberMe] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Field focus and touch status for validation styling
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);
  const [touchedConfirmPassword, setTouchedConfirmPassword] = useState(false);

  // Auto redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedRole = localStorage.getItem("role");
    if (token && storedRole) {
      if (storedRole === "Viewer") {
        navigate("/MySupport", { replace: true });
      } else if (storedRole === "Admin" || storedRole === "Super Administrator" || storedRole === "Administrator") {
        navigate("/Admin", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [navigate]);

  // Email format validation helper
  const isValidEmail = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  // Password strength calculation
  const calculatePasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const passwordStrength = calculatePasswordStrength(password);

  const getStrengthLabel = (score: number) => {
    if (!password) return { text: "Too Short", color: "bg-slate-700" };
    if (score < 2) return { text: "Weak Password", color: "bg-danger" };
    if (score < 4) return { text: "Medium Security", color: "bg-warning" };
    return { text: "Strong Security", color: "bg-success" };
  };

  const strengthDetails = getStrengthLabel(passwordStrength);

  const handleRoleRedirect = (userRole: string) => {
    if (userRole === "Viewer") {
      navigate("/MySupport");
    } else if (userRole === "Admin" || userRole === "Super Administrator" || userRole === "Administrator") {
      navigate("/Admin");
    } else {
      navigate("/");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    // Validation checks
    if (!isValidEmail(email)) {
      setError("Please input a valid enterprise corporate email address.");
      return;
    }

    if (authMode === "register") {
      if (!fullName.trim()) {
        setError("Corporate User Name is required.");
        return;
      }
      if (!company.trim()) {
        setError("Company entity name is required.");
        return;
      }
      if (!department.trim()) {
        setError("Assigned Department is required.");
        return;
      }
      if (passwordStrength < 2) {
        setError("Your password is too weak. Please include letters, numbers, and symbols.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Password confirmations do not match.");
        return;
      }
      if (!acceptTerms) {
        setError("You must accept the terms of service and security policy.");
        return;
      }
    }

    setLoading(true);

    try {
      if (authMode === "register") {
        // Sign Up
        await api.post("/auth/register", {
          email,
          full_name: fullName,
          role,
          password,
          department: department,
          job_title: company // Store Company name in job_title schema field
        });
        setMessage("Corporate staff account provisioned successfully! Please sign in.");
        setAuthMode("login");
        setPassword("");
        setConfirmPassword("");
        setTouchedPassword(false);
        setTouchedConfirmPassword(false);
      } else {
        // Sign In with timing instrumentation
        const t0 = performance.now();
        localStorage.setItem("login_click_time", t0.toString());

        const data: any = await api.post("/auth/login", { email, password });
        const t1 = performance.now();
        
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("role", data.role);
        localStorage.setItem("user_name", data.full_name);
        if (data.refresh_token) {
          localStorage.setItem("refresh_token", data.refresh_token);
        }
        const t2 = performance.now();
        
        console.log(
          `[AUTH PERF] Authentication timing trace:\n` +
          `  - API latency: ${(t1 - t0).toFixed(2)}ms\n` +
          `  - Session storage write: ${(t2 - t1).toFixed(2)}ms\n` +
          `  - Total client auth time: ${(performance.now() - t0).toFixed(2)}ms`
        );
        
        handleRoleRedirect(data.role);
      }
    } catch (err: any) {
      setError(err.message || "Authentication sweep failed. Connection timeout.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !isValidEmail(email)) {
      setError("Please fill in a valid corporate Email address to dispatch reset link.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data: any = await api.post("/auth/forgot-password", { email });
      setMessage(data.message || "Secure credentials recovery dispatch complete.");
    } catch (err: any) {
      setError(err.message || "Failed to dispatch reset request.");
    } finally {
      setLoading(false);
    }
  };

  // Field validation visual feedback helper classes
  const getEmailBorderClass = () => {
    if (!touchedEmail || !email) return "border-slate-800/80 focus:border-primary focus:ring-primary/20";
    return isValidEmail(email) 
      ? "border-success/50 focus:border-success focus:ring-success/20" 
      : "border-danger/50 focus:border-danger focus:ring-danger/20";
  };

  const getPasswordBorderClass = () => {
    if (!touchedPassword || !password) return "border-slate-800/80 focus:border-primary focus:ring-primary/20";
    if (authMode === "register") {
      if (passwordStrength < 2) return "border-danger/50 focus:border-danger focus:ring-danger/20";
      if (passwordStrength < 4) return "border-warning/50 focus:border-warning focus:ring-warning/20";
      return "border-success/50 focus:border-success focus:ring-success/20";
    }
    return "border-slate-800/80 focus:border-primary focus:ring-primary/20";
  };

  const getConfirmPasswordBorderClass = () => {
    if (!touchedConfirmPassword || !confirmPassword) return "border-slate-800/80 focus:border-primary focus:ring-primary/20";
    return password === confirmPassword 
      ? "border-success/50 focus:border-success focus:ring-success/20" 
      : "border-danger/50 focus:border-danger focus:ring-danger/20";
  };

  return (
    <div className="flex h-screen w-screen bg-[#0B1120] overflow-hidden select-none">
      
      {/* LEFT SIDE: Futuristic IT Operations Center Illustration */}
      <div className="hidden lg:block lg:w-1/2 xl:w-[58%] h-full relative">
        <ITOpsIllustration />
      </div>

      {/* RIGHT SIDE: Authentication Card Layout */}
      <div className="w-full lg:w-1/2 xl:w-[42%] h-full flex flex-col justify-center items-center px-6 py-12 md:px-16 overflow-y-auto bg-radial-gradient relative">
        
        {/* Ambient background glows for card */}
        <div className="absolute top-[10%] right-[10%] w-72 h-72 rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[10%] left-[10%] w-72 h-72 rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md z-10">
          
          {/* Logo & Platform identity header */}
          <div className="flex flex-col items-center text-center mb-8">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/25 shadow-lg shadow-blue-500/5 mb-4"
            >
              <ShieldCheck className="h-8 w-8 text-primary animate-pulse" />
            </motion.div>
            
            <motion.h1 
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="text-2xl font-black text-white tracking-[0.05em] uppercase"
            >
              SupportFlow
            </motion.h1>
            
            <motion.p 
              initial={{ y: -5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-xs font-semibold text-slate-400 mt-1 max-w-[280px] leading-relaxed"
            >
              Enterprise IT Support & Endpoint Management Platform
            </motion.p>
          </div>

          {/* Centered Glassmorphic Card Container */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="bg-[#111827]/70 backdrop-blur-xl border border-slate-800/80 rounded-[20px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] shadow-blue-950/20 w-full"
          >
            
            {/* Action State Title */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white tracking-wide">
                {authMode === "login" && "Welcome to SupportFlow"}
                {authMode === "register" && "Create Your Account"}
                {authMode === "forgot-password" && "Reset Credentials"}
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                {authMode === "login" && "Secure access for Employees and Administrators."}
                {authMode === "register" && "Provision a corporate staff profile inside the operations gateway."}
                {authMode === "forgot-password" && "Dispatches a cryptographically secure token reset link."}
              </p>
              {isOffline && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/35 rounded-xl text-[10px] font-bold text-amber-500 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                  {isStarting ? "Backend is starting..." : "Working Offline. Reconnecting..."}
                </div>
              )}
            </div>

            {/* Notification messages */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mb-4 bg-danger/10 border border-danger/20 text-danger text-xs font-medium p-3 rounded-xl flex items-start gap-2.5 overflow-hidden"
                >
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </motion.div>
              )}
              {message && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mb-4 bg-success/10 border border-success/20 text-success text-xs font-medium p-3 rounded-xl flex items-start gap-2.5 overflow-hidden"
                >
                  <Check className="h-4 w-4 shrink-0 mt-0.5 text-success" />
                  <span>{message}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* AUTH FORMS CONTAINER */}
            {authMode !== "forgot-password" ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* REGISTER FIELDS: Full Name */}
                {authMode === "register" && (
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder=" "
                      className="block pl-10 pr-3.5 pb-2.5 pt-5 w-full text-sm text-white bg-slate-900/40 border border-slate-800/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary peer transition-all duration-200"
                    />
                    <label className="absolute text-xs text-slate-500 duration-200 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-10 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 peer-focus:text-primary pointer-events-none">
                      Full Name
                    </label>
                  </div>
                )}

                {/* REGISTER FIELDS: Company & Department */}
                {authMode === "register" && (
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                        <Building className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder=" "
                        className="block pl-10 pr-3.5 pb-2.5 pt-5 w-full text-sm text-white bg-slate-900/40 border border-slate-800/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary peer transition-all duration-200"
                      />
                      <label className="absolute text-xs text-slate-500 duration-200 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-10 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 peer-focus:text-primary pointer-events-none">
                        Company
                      </label>
                    </div>

                    <div className="relative group">
                      <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                        <Users className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder=" "
                        className="block pl-10 pr-3.5 pb-2.5 pt-5 w-full text-sm text-white bg-slate-900/40 border border-slate-800/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary peer transition-all duration-200"
                      />
                      <label className="absolute text-xs text-slate-500 duration-200 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-10 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 peer-focus:text-primary pointer-events-none">
                        Department
                      </label>
                    </div>
                  </div>
                )}

                {/* Email Address */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onBlur={() => setTouchedEmail(true)}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder=" "
                    className={`block pl-10 pr-10 pb-2.5 pt-5 w-full text-sm text-white bg-slate-900/40 border rounded-xl focus:outline-none focus:ring-1 peer transition-all duration-200 ${getEmailBorderClass()}`}
                  />
                  <label className="absolute text-xs text-slate-500 duration-200 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-10 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 peer-focus:text-primary pointer-events-none">
                    Work Email
                  </label>
                  {touchedEmail && email && (
                    <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none">
                      {isValidEmail(email) ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <ShieldAlert className="h-4 w-4 text-danger" />
                      )}
                    </div>
                  )}
                </div>

                {/* Password field */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onBlur={() => setTouchedPassword(true)}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=" "
                    className={`block pl-10 pr-12 pb-2.5 pt-5 w-full text-sm text-white bg-slate-900/40 border rounded-xl focus:outline-none focus:ring-1 peer transition-all duration-200 ${getPasswordBorderClass()}`}
                  />
                  <label className="absolute text-xs text-slate-500 duration-200 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-10 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 peer-focus:text-primary pointer-events-none">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3.5 flex items-center text-slate-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* REGISTER: Password Strength Meter & Confirm Password */}
                {authMode === "register" && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-3.5 overflow-hidden"
                  >
                    {/* Strength Bars visual */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-500">PASSWORD STRENGTH</span>
                        <span className={`px-1.5 py-0.5 rounded uppercase tracking-wide text-white ${strengthDetails.color}`}>
                          {strengthDetails.text}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div 
                            key={level} 
                            className={`h-1 rounded-full transition-all duration-300 ${
                              passwordStrength >= level 
                                ? strengthDetails.color
                                : "bg-slate-800"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Confirm Password input */}
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onBlur={() => setTouchedConfirmPassword(true)}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder=" "
                        className={`block pl-10 pr-12 pb-2.5 pt-5 w-full text-sm text-white bg-slate-900/40 border rounded-xl focus:outline-none focus:ring-1 peer transition-all duration-200 ${getConfirmPasswordBorderClass()}`}
                      />
                      <label className="absolute text-xs text-slate-500 duration-200 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-10 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 peer-focus:text-primary pointer-events-none">
                        Confirm Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-3.5 flex items-center text-slate-500 hover:text-white transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* REGISTER FIELDS: Assign Operations Role Custom Layout Picker */}
                {authMode === "register" && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Assign Operational Role
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "Viewer", label: "Employee", desc: "Portal Access" },
                        { id: "Admin", label: "Admin", desc: "Full Control" }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setRole(item.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all duration-200 ${
                            role === item.id 
                              ? "bg-primary/10 border-primary text-white shadow-md shadow-primary/5" 
                              : "bg-slate-900/30 border-slate-800 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                          }`}
                        >
                          <div className="text-xs font-bold">{item.label}</div>
                          <div className="text-[9px] text-slate-500 font-medium mt-0.5 leading-none">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* LOGIN: Session checks, Forgot Password */}
                {authMode === "login" && (
                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center text-slate-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded bg-slate-900/60 border-slate-800 text-primary focus:ring-0 focus:ring-offset-0 mr-2 transition-colors cursor-pointer"
                      />
                      Remember Me
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("forgot-password");
                        setError(null);
                        setMessage(null);
                      }}
                      className="text-primary hover:text-blue-400 transition-colors font-semibold"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}

                {/* REGISTER: Accept Terms Agreement */}
                {authMode === "register" && (
                  <label className="flex items-start text-xs text-slate-400 cursor-pointer select-none leading-relaxed">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="h-4 w-4 rounded bg-slate-900/60 border-slate-800 text-primary focus:ring-0 focus:ring-offset-0 mr-2 mt-0.5 transition-colors cursor-pointer shrink-0"
                    />
                    <span>
                      I agree to the SupportFlow security guidelines, network policy, and corporate code of conduct.
                    </span>
                  </label>
                )}

                {/* Submit action button */}
                <motion.button
                  type="submit"
                  disabled={loading || isOffline}
                  whileHover={{ scale: 1.01, boxShadow: "0 4px 20px rgba(37, 99, 235, 0.25)" }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full py-3 bg-primary hover:bg-blue-600 text-white rounded-xl text-sm font-bold transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-4 shadow-md shadow-primary/10 border border-blue-500/10 cursor-pointer"
                >
                  {loading ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : isOffline ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                      Connecting securely...
                    </span>
                  ) : (
                    <>
                      {authMode === "login" ? "Sign In" : "Create Account"}
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </motion.button>
              </form>
            ) : (
              /* FORGOT PASSWORD FORM */
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-primary transition-colors">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder=" "
                    className="block pl-10 pr-3.5 pb-2.5 pt-5 w-full text-sm text-white bg-slate-900/40 border border-slate-800/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary peer transition-all duration-200"
                  />
                  <label className="absolute text-xs text-slate-500 duration-200 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] left-10 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 peer-focus:text-primary pointer-events-none">
                    Corporate Email
                  </label>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.01, boxShadow: "0 4px 20px rgba(37, 99, 235, 0.25)" }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full py-3 bg-primary hover:bg-blue-600 text-white rounded-xl text-sm font-bold transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2 shadow-md shadow-primary/10 border border-blue-500/10 cursor-pointer"
                >
                  {loading ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Send Reset Link"
                  )}
                </motion.button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setError(null);
                    setMessage(null);
                  }}
                  className="w-full py-2.5 bg-transparent text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-2 border border-slate-800 hover:border-slate-700 active:scale-[0.98] mt-2 cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Sign In
                </button>
              </form>
            )}

            {/* Auth mode toggles and SSO Options (only for Login view) */}
            {authMode === "login" && (
              <div className="mt-6 space-y-6">
                
                {/* Or Continue With divider */}
                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-800/80 w-full" />
                  <span className="absolute bg-[#111827] px-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
                    or continue with
                  </span>
                </div>

                {/* Identity Provider SSO Buttons */}
                <div className="grid grid-cols-2 gap-3.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMessage("Google authentication sweep initialized. Redirecting...");
                    }}
                    className="flex items-center justify-center py-2.5 px-4 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs font-semibold text-slate-300 hover:bg-slate-800/40 hover:text-white transition-all duration-200 cursor-pointer"
                  >
                    <svg className="h-4 w-4 mr-2.5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMessage("Microsoft directory auth sweep initialized. Redirecting...");
                    }}
                    className="flex items-center justify-center py-2.5 px-4 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs font-semibold text-slate-300 hover:bg-slate-800/40 hover:text-white transition-all duration-200 cursor-pointer"
                  >
                    <svg className="h-4 w-4 mr-2.5 shrink-0" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
                      <path d="M0 0h11v11H0z" fill="#F25022"/>
                      <path d="M12 0h11v11H12z" fill="#7FBA00"/>
                      <path d="M0 12h11v11H0z" fill="#00A4EF"/>
                      <path d="M12 12h11v11H12z" fill="#FFB900"/>
                    </svg>
                    Microsoft
                  </button>
                </div>

                {/* Direct Register toggle link */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("register");
                      setError(null);
                      setMessage(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white font-medium transition-colors cursor-pointer"
                  >
                    Need a staff account? <span className="text-primary font-bold hover:underline">Create Account</span>
                  </button>
                </div>
              </div>
            )}

            {/* Register back-to-login toggle link */}
            {authMode === "register" && (
              <div className="text-center mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setError(null);
                    setMessage(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white font-medium transition-colors cursor-pointer"
                >
                  Already have a staff account? <span className="text-primary font-bold hover:underline">Sign In</span>
                </button>
              </div>
            )}

          </motion.div>
          
          {/* External Legal disclaimer / Info row */}
          <div className="text-center mt-8 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Secured under encryption policy H26-OPS-4096. 
            <br />
            © 2026 SupportFlow. Enterprise IT Support & Endpoint Management Platform.
          </div>

        </div>
      </div>
    </div>
  );
}
