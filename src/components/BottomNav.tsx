import { NavLink } from "react-router-dom";
import { IconCollection, IconWealth, IconSettings } from "./Icons";

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink
        to="/collection"
        className={({ isActive }) => (isActive ? "active coll" : "")}
      >
        <IconCollection />
        <span>Collection</span>
      </NavLink>
      <NavLink
        to="/patrimoine"
        className={({ isActive }) => (isActive ? "active" : "")}
      >
        <IconWealth />
        <span>Patrimoine</span>
      </NavLink>
      <NavLink
        to="/parametres"
        className={({ isActive }) => (isActive ? "active" : "")}
      >
        <IconSettings />
        <span>Réglages</span>
      </NavLink>
    </nav>
  );
}
