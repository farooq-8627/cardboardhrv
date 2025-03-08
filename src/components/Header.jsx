import React from "react";
import { Link, useLocation } from "react-router-dom";

function Header() {
	const location = useLocation();
	const { pathname } = location;

	return (
		<>
			<header className="app-header">
				<div className="inner-header">
					<div className="logo">
						<Link to="/">
							<h1>CardboardHRV</h1>
						</Link>
					</div>
					<div className="header-actions">
						{/* Optional: Add header actions like login/settings buttons here */}
					</div>
				</div>
			</header>
			<nav className="main-nav">
				<ul>
					<li>
						<Link to="/" className={pathname === "/" ? "active" : ""}>
							Home
						</Link>
					</li>
					<li>
						<Link to="/monitor" className={pathname === "/monitor" ? "active" : ""}>
							Live Monitor
						</Link>
					</li>
					<li>
						<Link to="/connect" className={pathname === "/connect" ? "active" : ""}>
							Connect Phone
						</Link>
					</li>
					<li>
						<Link to="/info" className={pathname === "/info" ? "active" : ""}>
							Project Info
						</Link>
					</li>
				</ul>
			</nav>
		</>
	);
}

export default Header;
