import { useEffect, useState } from "react";
import { logout, getRole, getAllIssues, updateIssueStatus, assignTechnician, getIssueImages, initializeAuthFromSession } from "../services/supabaseService";
import { useNavigate } from "react-router-dom";
import "./admin.css";

function AdminDashboard() {

  const navigate = useNavigate();

  const [issues, setIssues] = useState([]);
  const [issueImages, setIssueImages] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const technicians = [
    "Not Assigned",
    "Rajesh Kumar",
    "Amit Sharma",
    "Vikram Singh",
    "Suresh Patel",
    "Technician Team A"
  ];

  useEffect(() => {
    const validateSession = async () => {
      try {
        const role = getRole() || await initializeAuthFromSession();
        if (role !== "admin") {
          navigate("/");
          return;
        }
        await loadIssues();
      } catch (error) {
        alert(error.message || "Please sign in with an authorized account.");
        navigate("/");
      }
    };

    validateSession();
  }, [navigate]);

  const loadIssues = async () => {

    setLoading(true);
    const fetchedIssues = await getAllIssues();
    setIssues(fetchedIssues);

    // Load images for each issue
    for (const issue of fetchedIssues) {
      const images = await getIssueImages(issue.id);
      setIssueImages(prev => ({
        ...prev,
        [issue.id]: images
      }));
    }

    setLoading(false);
  };

  const updateStatus = async (id, newStatus) => {

    setLoading(true);
    await updateIssueStatus(id, newStatus);
    await loadIssues();
    setLoading(false);
  };

  const handleAssignTechnician = async (id, tech) => {

    setLoading(true);
    await assignTechnician(id, tech);
    await loadIssues();
    setLoading(false);
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

        <button onClick={async () => {
          await logout();
          navigate("/");
        }}>
          Logout
        </button>

      </div>

      <div className="main-content">

        <h1>Admin Dashboard</h1>

        <div className="card">

          <h3>All Issues</h3>

          {loading ? (
            <p>Loading issues...</p>
          ) : issues.length === 0 ? (
            <p>No issues reported yet.</p>
          ) : (
            <table>

              <thead>

                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Technician</th>
                  <th>Student Email</th>
                  <th>Images</th>
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
                      {issue.student_email}
                    </td>

                    <td>
                      {issueImages[issue.id] && issueImages[issue.id].length > 0 ? (
                        <div className="image-gallery">
                          {issueImages[issue.id].map((img, idx) => (
                            <button 
                              key={idx} 
                              onClick={() => setSelectedImage(img.image_url)}
                              className="image-link"
                              title="Click to view image"
                            >
                              📷 View
                            </button>
                          ))}
                        </div>
                      ) : (
                        "No images"
                      )}
                    </td>

                    <td>

                      <select
                        value={issue.technician}
                        onChange={(e) =>
                          handleAssignTechnician(
                            issue.id,
                            e.target.value
                          )
                        }
                        disabled={loading}
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
                        disabled={loading}
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
          )}

        </div>

      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedImage(null)}>✕</button>
            <img src={selectedImage} alt="Issue" className="modal-image" />
          </div>
        </div>
      )}

    </div>

  );
}

export default AdminDashboard;
