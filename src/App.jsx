import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import LiveMonitor from "./components/LiveMonitor";
import ConnectPhone from "./components/ConnectPhone";
import ProjectInfo from "./components/ProjectInfo";
import ConnectMobile from "./components/ConnectMobile";
import { AppContextProvider } from "./context/AppContext";
import "./App.css";
import "./styles/App.css";

function App() {
	return (
		<AppContextProvider.AppProvider>
			<Router>
				<div className="app-container">
					<Header />
					<main className="main-content">
						<Routes>
							<Route
								path="/"
								element={
									<div className="home-container">
										<div className="hero-section">
											<h1>CardboardHRV</h1>
											<h2>
												Bridging Virtual Reality and Biofeedback with a
												Cost-Effective Heart Rate Variability System
											</h2>
											<p className="subtitle">
												Transform your smartphone into a heart rate monitor
												using just your phone's camera and a simple cardboard
												attachment.
											</p>
											<Link to="/connect" className="cta-button">
												Get Started
											</Link>
										</div>

										<div className="features-section">
											<h2>Key Features</h2>
											<div className="features-grid">
												<div className="feature-card">
													<div className="feature-icon">📱</div>
													<h3>Mobile-First Design</h3>
													<p>
														Use your smartphone's camera for accurate PPG signal
														detection
													</p>
												</div>
												<div className="feature-card">
													<div className="feature-icon">💓</div>
													<h3>Real-time HRV Analysis</h3>
													<p>
														Monitor heart rate variability metrics in real-time
													</p>
												</div>
												<div className="feature-card">
													<div className="feature-icon">🎯</div>
													<h3>Biofeedback Training</h3>
													<p>
														Improve heart rate variability through guided
														exercises
													</p>
												</div>
												<div className="feature-card">
													<div className="feature-icon">📊</div>
													<h3>Data Visualization</h3>
													<p>
														View your HRV data through intuitive charts and
														metrics
													</p>
												</div>
											</div>
										</div>

										<div className="how-it-works-section">
											<h2>How It Works</h2>
											<div className="steps-grid">
												<div className="step-card">
													<div className="step-number">1</div>
													<h3>Connect Your Phone</h3>
													<p>
														Scan the QR code to link your smartphone with the
														system
													</p>
												</div>
												<div className="step-card">
													<div className="step-number">2</div>
													<h3>Position Camera</h3>
													<p>
														Place your finger over the camera lens for PPG
														measurement
													</p>
												</div>
												<div className="step-card">
													<div className="step-number">3</div>
													<h3>Start Monitoring</h3>
													<p>
														View real-time heart rate and HRV metrics on your
														desktop
													</p>
												</div>
											</div>
										</div>

										<div className="research-section">
											<h2>Research-Based Approach</h2>
											<div className="research-content">
												<p>
													CardboardHRV combines proven photoplethysmography
													(PPG) techniques with accessible VR technology to
													create an affordable yet effective HRV biofeedback
													system. Our approach is based on established research
													in:
												</p>
												<ul>
													<li>Heart Rate Variability Analysis</li>
													<li>Mobile PPG Signal Processing</li>
													<li>Virtual Reality Biofeedback</li>
													<li>Stress Reduction Techniques</li>
												</ul>
											</div>
										</div>

										<div className="cta-section">
											<h2>Ready to Start?</h2>
											<p>
												Begin monitoring your heart rate variability in just a
												few clicks
											</p>
											<Link to="/connect" className="cta-button">
												Connect Your Device
											</Link>
										</div>
									</div>
								}
							/>
							<Route path="/monitor" element={<LiveMonitor />} />
							<Route path="/connect" element={<ConnectPhone />} />
							<Route path="/info" element={<ProjectInfo />} />
							<Route path="/mobile" element={<ConnectMobile />} />
						</Routes>
					</main>
					<Footer />
				</div>
			</Router>
		</AppContextProvider.AppProvider>
	);
}

export default App;
