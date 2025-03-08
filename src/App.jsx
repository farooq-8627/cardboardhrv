import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import LiveMonitor from "./components/LiveMonitor";
import ProjectInfo from "./components/ProjectInfo";
import ConnectPhone from "./components/ConnectPhone";
import "./App.css";

function App() {
	const [isConnected, setIsConnected] = useState(false);
	const [heartRateData, setHeartRateData] = useState([]);
	const [currentHeartRate, setCurrentHeartRate] = useState(0);
	const [hrvMetrics, setHrvMetrics] = useState({
		rmssd: 0,
		sdnn: 0,
		pnn50: 0,
	});

	// This would be replaced with actual WebSocket connection to your Python backend
	const connectToBackend = (deviceId) => {
		console.log(`Connecting to device: ${deviceId}`);

		// Simulate connection
		setIsConnected(true);

		// Simulate receiving heart rate data
		const interval = setInterval(() => {
			// This would be replaced with actual data from your WebSocket
			const newHeartRate = Math.floor(60 + Math.random() * 30);
			setCurrentHeartRate(newHeartRate);

			setHeartRateData((prevData) => {
				const newData = [
					...prevData,
					{
						time: new Date(),
						value: newHeartRate,
					},
				];

				// Keep only the last 30 seconds of data
				if (newData.length > 60) {
					return newData.slice(newData.length - 60);
				}
				return newData;
			});

			// Simulate HRV metrics updates every 5 seconds
			if (Math.random() > 0.8) {
				setHrvMetrics({
					rmssd: Math.floor(20 + Math.random() * 40),
					sdnn: Math.floor(30 + Math.random() * 50),
					pnn50: Math.floor(10 + Math.random() * 30),
				});
			}
		}, 1000);

		return () => clearInterval(interval);
	};

	return (
		<Router>
			<div className="app-container">
				<Header />
				<nav className="main-nav">
					<ul>
						<li>
							<Link to="/">Home</Link>
						</li>
						<li>
							<Link to="/monitor">Live Monitor</Link>
						</li>
						<li>
							<Link to="/connect">Connect Phone</Link>
						</li>
						<li>
							<Link to="/info">Project Info</Link>
						</li>
					</ul>
				</nav>

				<main className="main-content">
					<Routes>
						<Route
							path="/"
							element={
								<div className="home-container">
									<h1>CardboardHRV</h1>
									<h2>
										Bridging Virtual Reality and Biofeedback with a
										Cost-Effective Heart Rate Variability System
									</h2>
									<div className="hero-section">
										<p>
											Welcome to the CardboardHRV research project. Our system
											provides an affordable and effective heart rate
											variability biofeedback solution using Google Cardboard
											VR.
										</p>
										<Link to="/connect" className="cta-button">
											Get Started
										</Link>
									</div>
								</div>
							}
						/>
						<Route
							path="/monitor"
							element={
								<LiveMonitor
									isConnected={isConnected}
									heartRateData={heartRateData}
									currentHeartRate={currentHeartRate}
									hrvMetrics={hrvMetrics}
								/>
							}
						/>
						<Route
							path="/connect"
							element={
								<ConnectPhone
									isConnected={isConnected}
									onConnect={connectToBackend}
								/>
							}
						/>
						<Route path="/info" element={<ProjectInfo />} />
					</Routes>
				</main>

				<Footer />
			</div>
		</Router>
	);
}

export default App;
