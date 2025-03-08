import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import LiveMonitor from "./components/LiveMonitor";
import ConnectPhone from "./components/ConnectPhone";
import ProjectInfo from "./components/ProjectInfo";
import ConnectMobile from "./components/ConnectMobile";
import { AppProvider } from "./context/AppContext";
import "./App.css";

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
												Heart Rate Variability Monitoring with Your Smartphone
											</h2>
											<p>
												Transform your smartphone into a heart rate monitor
												using just your phone's camera and a simple cardboard
												attachment.
											</p>
											<Link to="/connect" className="cta-button">
												Get Started
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
