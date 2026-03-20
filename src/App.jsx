import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./components/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import StudentDashboard from "./dashboards/StudentDashboard";
import AdminDashboard from "./dashboards/AdminDashboard";
import TechnicianDashboard from "./dashboards/TechnicianDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/student"
          element={(
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/admin"
          element={(
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/technician"
          element={(
            <ProtectedRoute allowedRoles={["technician"]}>
              <TechnicianDashboard />
            </ProtectedRoute>
          )}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


/* export default App; */
