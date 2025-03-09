import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import LiveMonitor from "./components/LiveMonitor";
import ConnectPhone from "./components/ConnectPhone";
import ProjectInfo from "./components/ProjectInfo";
import ConnectMobile from "./components/ConnectMobile";
import { AppProvider } from "./context/AppContext";
import "./App.css";
import "./styles/App.css";

function App() {
	return (
		<AppProvider>
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
												Affordable Heart Rate Variability Monitoring Using Your
												Smartphone
											</h2>
											<p className="subtitle">
												A research-based approach to measure heart rate
												variability through photoplethysmography using your
												smartphone's camera and a simple cardboard attachment.
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
													<h3>Smartphone PPG</h3>
													<p>
														Uses your phone's camera to capture
														photoplethysmography signals from your forehead
													</p>
												</div>
												<div className="feature-card">
													<div className="feature-icon">💓</div>
													<h3>Real-time Analysis</h3>
													<p>
														Processes PPG signals to calculate heart rate and
														HRV metrics in real-time
													</p>
												</div>
												<div className="feature-card">
													<div className="feature-icon">📊</div>
													<h3>HRV Metrics</h3>
													<p>
														Measures key HRV parameters including SDNN, RMSSD,
														LF, HF, and LF/HF ratio
													</p>
												</div>
												<div className="feature-card">
													<div className="feature-icon">💰</div>
													<h3>Cost-Effective</h3>
													<p>
														Affordable alternative to expensive HRV monitoring
														devices using existing technology
													</p>
												</div>
											</div>
										</div>

										<div className="how-it-works-section">
											<h2>How It Works</h2>
											<div className="steps-grid">
												<div className="step-card">
													<div className="step-number">1</div>
													<h3>Optical Setup</h3>
													<p>
														Position your phone in the cardboard holder with the
														optical fiber attachment
													</p>
												</div>
												<div className="step-card">
													<div className="step-number">2</div>
													<h3>Signal Capture</h3>
													<p>
														Camera captures PPG signals from your lateral
														forehead through the optical fiber
													</p>
												</div>
												<div className="step-card">
													<div className="step-number">3</div>
													<h3>Data Processing</h3>
													<p>
														Advanced algorithms process the PPG signal to
														extract heart rate and HRV metrics
													</p>
												</div>
											</div>
										</div>

										<div className="research-section">
											<h2>Research Foundation</h2>
											<div className="research-content">
												<p>
													CardboardHRV is built on established research in
													photoplethysmography and heart rate variability
													analysis. Our approach combines:
												</p>
												<ul>
													<li>Validated PPG Signal Processing Techniques</li>
													<li>Clinical HRV Analysis Standards</li>
													<li>Affordable Hardware Solutions</li>
													<li>Real-time Data Processing Methods</li>
												</ul>
											</div>
										</div>

										<div className="cta-section">
											<h2>Ready to Monitor Your HRV?</h2>
											<p>
												Start measuring your heart rate variability with just
												your smartphone and our simple setup
											</p>
											<Link to="/connect" className="cta-button">
												Begin Monitoring
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
		</AppProvider>
	);
}

export default App;
