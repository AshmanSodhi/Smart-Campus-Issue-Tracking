import { useEffect, useState } from "react";
import { logout, getRole } from "../services/authService";
import { useNavigate } from "react-router-dom";
import "./admin.css";

function AdminDashboard() {

  const navigate = useNavigate();

  const [issues, setIssues] = useState([]);

  const technicians = [
    "Not Assigned",
    "Rajesh Kumar",
    "Amit Sharma",
    "Vikram Singh",
    "Suresh Patel",
    "Technician Team A"
  ];

  useEffect(() => {

    if (getRole() !== "admin") {
      navigate("/");
    }

    loadIssues();

  }, []);

  const loadIssues = () => {

    const storedIssues =
      JSON.parse(localStorage.getItem("studentIssues")) || [];

    setIssues(storedIssues);
  };

  const updateStatus = (id, newStatus) => {

    const updated = issues.map(issue =>
      issue.id === id
        ? { ...issue, status: newStatus }
        : issue
    );

    saveIssues(updated);
  };

  const assignTechnician = (id, tech) => {

    const updated = issues.map(issue =>
      issue.id === id
        ? { ...issue, technician: tech }
        : issue
    );

    saveIssues(updated);
  };

  const saveIssues = (updatedIssues) => {

    setIssues(updatedIssues);

    localStorage.setItem(
      "studentIssues",
      JSON.stringify(updatedIssues)
    );
  };

  const getStatusClass = (status) => {

    if (status === "Pending") return "status pending";
    if (status === "In Progress") return "status inprogress";
    if (status === "Resolved") return "status resolved";

    return "status";
  };

  return (

    <div className="dashboard-container">

      <div className="sidebar">

        <h2>Admin Panel</h2>

        <button>Manage Issues</button>

        <button onClick={() => {
          logout();
          navigate("/");
        }}>
          Logout
        </button>

      </div>

      <div className="main-content">

        <h1>Admin Dashboard</h1>

        <div className="card">

          <h3>All Issues</h3>

          <table>

            <thead>

              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Category</th>
                <th>Location</th>
                <th>Status</th>
                <th>Technician</th>
                <th>Assign Technician</th>
                <th>Change Status</th>
              </tr>

            </thead>

            <tbody>

              {issues.map(issue => (

                <tr key={issue.id}>

                  <td>{issue.id}</td>

                  <td>{issue.title}</td>

                  <td>{issue.category}</td>

                  <td>{issue.location}</td>

                  <td>
                    <span className={
                      getStatusClass(issue.status)
                    }>
                      {issue.status}
                    </span>
                  </td>

                  <td>
                    {issue.technician}
                  </td>

                  <td>

                    <select
                      value={issue.technician}
                      onChange={(e) =>
                        assignTechnician(
                          issue.id,
                          e.target.value
                        )
                      }
                    >

                      {technicians.map((tech, index) => (

                        <option key={index}>
                          {tech}
                        </option>

                      ))}

                    </select>

                  </td>

                  <td>

                    <select
                      value={issue.status}
                      onChange={(e) =>
                        updateStatus(
                          issue.id,
                          e.target.value
                        )
                      }
                    >

                      <option>Pending</option>
                      <option>In Progress</option>
                      <option>Resolved</option>

                    </select>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>

    </div>

  );
}

export default AdminDashboard;
