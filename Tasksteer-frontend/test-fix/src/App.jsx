import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut,
    updateProfile, 
    sendPasswordResetEmail,
    signInWithCustomToken
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    serverTimestamp,
    collection, 
    query,      
    where,      
    getDocs     
} from 'firebase/firestore';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';


// Firebase configuration
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "AIzaSyBPneX8HLvkg1z6fGpTKUDDFOFUJkdf-iA",
    authDomain: "tasksteer.firebaseapp.com",
    projectId: "tasksteer",
    storageBucket: "tasksteer.appspot.com",
    messagingSenderId: "553442098430",
    appId: "1:553442098430:web:9a79768fe81bdd15a379af",
    measurementId: "G-WQ2MC2GJNS"
};

// App ID for Firestore paths
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); 
const googleProvider = new GoogleAuthProvider();

// --- Reusable Icon Components ---
const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
);

const EyeSlashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
);

const GoogleIcon = () => (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
);

// --- Branding Panel Component Definition ---
const BrandingPanel = () => (
    <div className="w-full md:w-1/2 bg-black p-8 md:p-12 text-white flex flex-col justify-center items-center md:items-start text-center md:text-left h-full">
        <div className="mb-8 flex items-center space-x-3"> 
            <img 
                id="logoImage" 
                src="/images/tasksteer-logo.png"  
                alt="TaskSteer Logo" 
                className="w-20 h-20 object-contain" // Safer logo size
                onError={(e) => { 
                    e.target.onerror = null; 
                    e.target.src='https://placehold.co/80x80/111827/FFFFFF?text=LOGO&font=inter'; 
                    e.target.alt='Logo not found. Place your logo in /public/images/tasksteer-logo.png';
                }}
            />
            <span className="text-5xl font-extrabold tracking-tight text-purple-500" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.3)'}}>TaskSteer</span>
        </div>
        <p className="text-xl mb-8 leading-relaxed font-medium text-gray-200">
            Seamless collaboration starts here. <br className="hidden sm:inline" /> Intelligent task tracking for teams that move fast.
        </p>
        <img 
            id="brandingIllustration" 
            src="/images/branding-illustration.png" 
            alt="Branding illustration" 
            className="w-full max-w-md mx-auto md:mx-0 rounded-xl shadow-xl mt-6 object-cover"
            onError={(e) => { 
                e.target.onerror = null; 
                e.target.src='https://placehold.co/380x250/1F2937/A855F7?text=Your+Illustration+Here&font=inter';
                e.target.alt='Illustration not found. Place your illustration in /public/images/branding-illustration.png';
            }}
        />
    </div>
);

// --- Helper function to create user profile in Firestore Definition ---
const createUserProfileDocument = async (user, additionalData) => {
    if (!user) return;
    const userRef = doc(db, `/artifacts/${appId}/users/${user.uid}`);
    const profileData = {
        email: user.email,
        displayName: user.displayName || additionalData.fullName || additionalData.username || '',
        username: additionalData.username || user.email.split('@')[0],
        createdAt: serverTimestamp(),
        fullName: additionalData.fullName || user.displayName || '',
    };
    Object.keys(profileData).forEach(key => profileData[key] === undefined && delete profileData[key]);

    try {
        await setDoc(userRef, profileData, { merge: true });
        console.log("User profile created/updated in Firestore for UID:", user.uid);
    } catch (error) {
        console.error("Error creating user profile in Firestore:", error);
    }
};

// --- Password Strength Component Definition ---
const PasswordStrengthIndicator = ({ password }) => {
    const getStrength = () => {
        let score = 0;
        if (!password) return 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        return Math.min(score, 5);
    };

    const strength = getStrength();
    const strengthLabels = ['Very Weak', 'Weak', 'Medium', 'Strong', 'Very Strong', 'Excellent'];
    const strengthColors = ['bg-red-500', 'bg-red-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500', 'bg-emerald-500'];
    
    if (!password) return null;

    return (
        <div className="mt-2">
            <div className="flex h-2 mb-1 rounded overflow-hidden">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className={`w-1/5 ${i < strength ? strengthColors[strength] : 'bg-gray-200'}`}></div>
                ))}
            </div>
            <p className={`text-xs ${strength < 2 ? 'text-red-500' : strength < 4 ? 'text-yellow-600' : 'text-green-600'}`}>
                Strength: {strengthLabels[strength]}
            </p>
        </div>
    );
};

// --- Login Component Definition ---
const Login = ({ onSwitchForm, showMessage }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showResetPassword, setShowResetPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        if (!email || !password) {
            const missingField = !email ? "Email" : "Password";
            setError(`${missingField} is required.`);
            showMessage(`${missingField} is required. Please fill it out.`, 'error');
            return;
        }
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            showMessage('Login successful! Redirecting...', 'success');
            navigate('/dashboard', { replace: true }); 
        } catch (err) {
            setError(err.message);
            showMessage(err.message, 'error');
        }
        setLoading(false);
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setLoading(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            await createUserProfileDocument(user, { 
                fullName: user.displayName, 
                username: user.email.split('@')[0] 
            });
            showMessage('Google Sign-In successful! Redirecting...', 'success');
            navigate('/dashboard', { replace: true });
        } catch (err) {
            setError(err.message);
            showMessage(err.message, 'error');
        }
        setLoading(false);
    };

    const handlePasswordResetRequest = async (e) => {
        e.preventDefault();
        if (!resetEmail) {
            setError("Email is required for password reset.");
            showMessage("Please enter your email address.", "error");
            return;
        }
        setResetLoading(true);
        setError('');
        try {
            await sendPasswordResetEmail(auth, resetEmail);
            showMessage(`Password reset email sent to ${resetEmail}. Please check your inbox.`, 'success');
            setShowResetPassword(false);
            setResetEmail('');
        } catch (err) {
            setError(err.message);
            showMessage(err.message, 'error');
        }
        setResetLoading(false);
    };

    return (
        <div> 
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Welcome Back!</h2>
            {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
            {!showResetPassword ? (
                <>
                    <form onSubmit={handleLogin} className="space-y-6" noValidate> 
                        <div>
                            <label htmlFor="loginEmail" className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                            <input type="email" id="loginEmail" value={email} onChange={(e) => setEmail(e.target.value)} className="custom-input w-full px-4 py-3.5 rounded-lg focus:outline-none transition-all duration-200" placeholder="you@example.com" />
                        </div>
                        <div>
                            <label htmlFor="loginPassword" className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                            <div className="relative">
                                <input type={showPassword ? "text" : "password"} id="loginPassword" value={password} onChange={(e) => setPassword(e.target.value)} className="custom-input w-full px-4 py-3.5 rounded-lg focus:outline-none transition-all duration-200 pr-10" placeholder="Enter your password" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-purple-600 transition-colors" aria-label="Toggle password visibility">
                                    {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center">
                                <input id="rememberMe" name="rememberMe" type="checkbox" className="custom-checkbox" />
                                <label htmlFor="rememberMe" className="ml-2.5 block text-sm text-gray-800">Remember me</label>
                            </div>
                            <button type="button" onClick={() => setShowResetPassword(true)} className="text-sm font-semibold text-purple-600 hover:text-purple-700 hover:underline transition-colors">Forgot password?</button>
                        </div>
                        <button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-white transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 active:translate-y-0 active:shadow-md disabled:opacity-50">
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>
                    <div className="my-6 flex items-center">
                        <div className="flex-grow border-t border-gray-300"></div>
                        <span className="mx-4 text-sm text-gray-500">Or continue with</span>
                        <div className="flex-grow border-t border-gray-300"></div>
                    </div>
                    <button type="button" onClick={handleGoogleSignIn} disabled={loading} className="w-full flex items-center justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-300 disabled:opacity-50">
                        <GoogleIcon />
                        Sign in with Google
                    </button>
                    <p className="mt-10 text-center text-sm text-gray-600">
                        Don't have an account? <button onClick={() => onSwitchForm('signup')} className="font-semibold text-purple-600 hover:text-purple-700 hover:underline transition-colors">Sign up</button>
                    </p>
                </>
            ) : (
                <form onSubmit={handlePasswordResetRequest} className="space-y-6" noValidate> 
                     <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">Reset Password</h3>
                    <div>
                        <label htmlFor="resetEmail" className="block text-sm font-semibold text-gray-700 mb-2">Enter your account email</label>
                        <input type="email" id="resetEmail" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="custom-input w-full px-4 py-3.5 rounded-lg focus:outline-none transition-all duration-200" placeholder="you@example.com" />
                    </div>
                    <button type="submit" disabled={resetLoading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-white transition-all duration-300 shadow-lg disabled:opacity-50">
                        {resetLoading ? 'Sending...' : 'Send Reset Email'}
                    </button>
                    <button type="button" onClick={() => setShowResetPassword(false)} className="w-full mt-2 text-sm text-purple-600 hover:text-purple-700 text-center">Back to Login</button>
                </form>
            )}
        </div>
    );
};

// --- Signup Component Definition ---
const Signup = ({ onSwitchForm, showMessage }) => {
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [usernameAvailable, setUsernameAvailable] = useState(true);
    const [usernameCheckLoading, setUsernameCheckLoading] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const navigate = useNavigate();

    const checkUsernameAvailability = useCallback(async (uname) => {
        if (!uname || uname.length < 3) {
            setUsernameAvailable(true);
            return;
        }
        setUsernameCheckLoading(true);
        try {
            const usersRef = collection(db, `/artifacts/${appId}/users`);
            const q = query(usersRef, where("username", "==", uname));
            const querySnapshot = await getDocs(q);
            setUsernameAvailable(querySnapshot.empty);
            if (!querySnapshot.empty) {
                setError("Username is already taken."); 
            } else {
                if(error === "Username is already taken.") setError("");
            }
        } catch (err) {
            console.error("Error checking username:", err);
            setUsernameAvailable(true); 
        }
        setUsernameCheckLoading(false);
    }, [error]); 

    const handleUsernameChange = (e) => {
        const newUsername = e.target.value;
        setUsername(newUsername);
        if (newUsername.length >= 3) {
            checkUsernameAvailability(newUsername);
        } else {
            setUsernameAvailable(true); 
            if(error === "Username is already taken.") setError("");
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setError(''); 

        if (!fullName) { setError("Full Name is required."); showMessage("Full Name is required. Please fill it out.", "error"); return; }
        if (!username) { setError("Username is required."); showMessage("Username is required. Please fill it out.", "error"); return; }
        if (!email) { setError("Email is required."); showMessage("Email is required. Please fill it out.", "error"); return; }
        if (!password) { setError("Password is required."); showMessage("Password is required. Please fill it out.", "error"); return; }
        if (!confirmPassword) { setError("Confirm Password is required."); showMessage("Confirm Password is required. Please fill it out.", "error"); return; }
        if (!agreedToTerms) { setError("You must agree to the Terms of Service and Privacy Policy."); showMessage("Please agree to the Terms & Conditions.", "error"); return; }


        if (password !== confirmPassword) {
            setError("Passwords do not match!");
            showMessage("Passwords do not match!", 'error');
            return;
        }
        if (!usernameAvailable) {
            setError("Username is already taken. Please choose another.");
            showMessage("Username is already taken.", 'error');
            return;
        }
        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await updateProfile(user, { displayName: fullName || username });
            await createUserProfileDocument(user, { fullName, username });
            showMessage('Signup successful! Redirecting...', 'success');
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
            showMessage(err.message, 'error');
        }
        setLoading(false);
    };
    
    const handleGoogleSignUp = async () => {
        setError('');
        setLoading(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            const generatedUsername = user.email.split('@')[0]; 
            await createUserProfileDocument(user, { 
                fullName: user.displayName, 
                username: generatedUsername 
            });
            showMessage('Google Sign-Up successful! Redirecting...', 'success');
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
            showMessage(err.message, 'error');
        }
        setLoading(false);
    };

    return (
        <div> 
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Create Your Account</h2>
            {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
            <form onSubmit={handleSignup} className="space-y-6" noValidate> 
                <div>
                    <label htmlFor="signUpName" className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                    <input type="text" id="signUpName" value={fullName} onChange={(e) => setFullName(e.target.value)} className="custom-input w-full px-4 py-3.5 rounded-lg focus:outline-none transition-all duration-200" placeholder="John Doe" />
                </div>
                <div>
                    <label htmlFor="signUpUsername" className="block text-sm font-semibold text-gray-700 mb-2">Username</label>
                    <input type="text" id="signUpUsername" value={username} onChange={handleUsernameChange} className={`custom-input w-full px-4 py-3.5 rounded-lg focus:outline-none transition-all duration-200 ${!usernameAvailable && username.length > 0 ? 'border-red-500 ring-red-500' : ''}`} placeholder="yourusername" />
                    {usernameCheckLoading && <p className="text-xs text-gray-500 mt-1">Checking username...</p>}
                    {!usernameCheckLoading && username.length > 0 && !usernameAvailable && <p className="text-xs text-red-500 mt-1">Username taken.</p>}
                    {!usernameCheckLoading && username.length > 0 && usernameAvailable && <p className="text-xs text-green-500 mt-1">Username available!</p>}
                </div>
                <div>
                    <label htmlFor="signUpEmail" className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                    <input type="email" id="signUpEmail" value={email} onChange={(e) => setEmail(e.target.value)} className="custom-input w-full px-4 py-3.5 rounded-lg focus:outline-none transition-all duration-200" placeholder="you@example.com" />
                </div>
                <div>
                    <label htmlFor="signUpPassword" className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                    <div className="relative">
                        <input type={showPassword ? "text" : "password"} id="signUpPassword" value={password} onChange={(e) => setPassword(e.target.value)} className="custom-input w-full px-4 py-3.5 rounded-lg focus:outline-none transition-all duration-200 pr-10" placeholder="Create a strong password" aria-describedby="passwordHelp" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-purple-600 transition-colors" aria-label="Toggle password visibility">
                            {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                        </button>
                    </div>
                    <PasswordStrengthIndicator password={password} />
                    <p id="passwordHelp" className="text-xs text-gray-500 mt-1.5">Min. 8 characters, 1 uppercase, 1 number.</p>
                </div>
                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                     <div className="relative">
                        <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="custom-input w-full px-4 py-3.5 rounded-lg focus:outline-none transition-all duration-200" placeholder="Confirm your password" />
                    </div>
                </div>
                <div className="pt-1"> 
                    <div className="flex items-start">
                        <input id="terms" name="terms" type="checkbox" className="custom-checkbox mt-0.5" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
                        <label htmlFor="terms" className="ml-2.5 block text-sm text-gray-800">I agree to the <a href="#" className="font-semibold text-purple-600 hover:text-purple-700 hover:underline transition-colors">Terms of Service</a> and <a href="#" className="font-semibold text-purple-600 hover:text-purple-700 hover:underline transition-colors">Privacy Policy</a>.</label>
                    </div>
                </div>
                <button type="submit" disabled={loading || usernameCheckLoading || (!usernameAvailable && username.length > 0)} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3.5 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-white transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 active:translate-y-0 active:shadow-md disabled:opacity-50">
                    {loading ? 'Creating Account...' : 'Create Account'}
                </button>
            </form>
            <div className="my-6 flex items-center">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="mx-4 text-sm text-gray-500">Or continue with</span>
                <div className="flex-grow border-t border-gray-300"></div>
            </div>
            <button type="button" onClick={handleGoogleSignUp} disabled={loading} className="w-full flex items-center justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-300 disabled:opacity-50">
                <GoogleIcon />
                Sign up with Google
            </button>
            <p className="mt-10 text-center text-sm text-gray-600">
                Already have an account? <button onClick={() => onSwitchForm('login')} className="font-semibold text-purple-600 hover:text-purple-700 hover:underline transition-colors">Login</button>
            </p>
        </div>
    );
};

// --- Message Component Definition ---
const MessageDisplay = ({ message, type, onClose }) => {
    if (!message) return null;
    const baseClasses = "fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white flex items-center justify-between z-50";
    const typeClasses = type === 'success' ? "bg-green-500" : "bg-red-500";
    return (
        <div className={`${baseClasses} ${typeClasses}`}>
            <span>{message}</span>
            <button onClick={onClose} className="ml-4 text-xl font-bold">&times;</button>
        </div>
    );
};

// --- Placeholder Dashboard Component ---
const Dashboard = () => {
    const navigate = useNavigate();
    const handleLogout = async () => {
        try {
            await signOut(auth);
            console.log('Logged out successfully!');
            navigate('/', { replace: true }); 
        } catch (error) {
            console.error(`Logout error: ${error.message}`);
        }
    };
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-200 p-4">
            <h1 className="text-4xl font-bold text-purple-600 mb-6">TaskSteer Dashboard</h1>
            <p className="text-lg mb-4">Welcome, {auth.currentUser?.displayName || auth.currentUser?.email || 'User'}!</p>
            <button 
                onClick={handleLogout}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
                Logout
            </button>
        </div>
    );
};

// --- Auth Page Component ---
const AuthPage = () => {
    const [currentView, setCurrentView] = useState('login');
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('success');
    
    const showMessage = useCallback((msg, type = 'success') => {
        setMessage(msg);
        setMessageType(type);
        setTimeout(() => setMessage(''), 5000); 
    }, []);

    const handleSwitchForm = (formType) => {
        setCurrentView(formType);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100"> 
            <MessageDisplay message={message} type={messageType} onClose={() => setMessage('')} />
            <div className="flex flex-col md:flex-row bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-5xl h-[95vh]">
                <BrandingPanel />
                <div className="w-full md:w-1/2 p-10 flex flex-col items-center justify-center bg-slate-50 h-full overflow-y-auto">
                    <div className="w-full"> 
                        {currentView === 'login' ? (
                            <Login onSwitchForm={handleSwitchForm} showMessage={showMessage} />
                        ) : (
                            <Signup onSwitchForm={handleSwitchForm} showMessage={showMessage} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- This is the main component that should be wrapped by a <Router> in your entry file (e.g., main.jsx) ---
export default function App() { 
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const navigate = useNavigate(); // This hook can only be used inside a component rendered by a Router

  useEffect(() => {
    // This effect should run only once to set up the auth listener
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe(); 
  }, []);
  
  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" replace />} />
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />}/>
        {/* Fallback route for any other path */}
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/"} replace />} />
    </Routes>
  );
}
