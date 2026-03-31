import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  adminDeleteUserRole,
  adminUpsertUserRole,
  assignTechnician,
  getAllIssues,
  getAllUserRoles,
  getAssignableTechnicians,
  getIssueImages,
  getNotifications,
  getTechnicianApplications,
  logout,
  markNotificationRead,
  reviewTechnicianApplication,
  updateIssueStatus,
} from "../services/supabaseService";
import { useNavigate } from "react-router-dom";
import { APP_CONFIG, getStatusBadgeClass } from "../config/appConfig";
import "./admin.css";

function AdminDashboard() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("issues");
  const [issues, setIssues] = useState([]);
  const [issueImages, setIssueImages] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [techApplications, setTechApplications] = useState([]);
  const [technicians, setTechnicians] = useState([APP_CONFIG.DEFAULT_NOT_ASSIGNED]);
  const [userRoles, setUserRoles] = useState([]);

  const [loading, setLoading] = useState(false);
  const [dbManagementLoading, setDbManagementLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [lastStatusChange, setLastStatusChange] = useState(null);

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState(APP_CONFIG.ROLES.CITIZEN);

  const [filters, setFilters] = useState({
    status: "All",
    officer: "All",
    category: "All",
    priority: "All",
  });

  const statusFilterRef = useRef(null);
  const notificationPanelRef = useRef(null);

  const metrics = useMemo(() => {
    const pending = issues.filter((issue) => issue.status === APP_CONFIG.ISSUE_STATUSES.PENDING).length;
    const inProgress = issues.filter((issue) => issue.status === APP_CONFIG.ISSUE_STATUSES.IN_PROGRESS).length;
    const resolved = issues.filter((issue) => issue.status === APP_CONFIG.ISSUE_STATUSES.RESOLVED).length;
    const closed = issues.filter((issue) => issue.status === APP_CONFIG.ISSUE_STATUSES.CLOSED).length;

    return {
      total: issues.length,
      pending,
      inProgress,
      resolved,
      closed,
    };
  }, [issues]);

  const pendingApplications = useMemo(
    () => techApplications.filter((application) => application.status?.toLowerCase() === APP_CONFIG.TECH_APP_STATUS.PENDING),
    [techApplications]
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedIssues = await getAllIssues(filters);
      setIssues(fetchedIssues);

      const imagePairs = await Promise.all(
        fetchedIssues.map(async (issue) => {
          const images = await getIssueImages(issue.id);
          return [issue.id, images];
        })
      );
      setIssueImages(Object.fromEntries(imagePairs));

      const [fetchedNotifications, fetchedTechApplications, fetchedTechnicians, fetchedUserRoles] =
        await Promise.all([
          getNotifications(),
          getTechnicianApplications("all"),
          getAssignableTechnicians(),
          getAllUserRoles(),
        ]);

      setNotifications(fetchedNotifications);
      const unreadCount = fetchedNotifications.filter((n) => !n.is_read).length;
      setUnreadNotificationCount(unreadCount);
      setTechApplications(fetchedTechApplications);
      setTechnicians([APP_CONFIG.DEFAULT_NOT_ASSIGNED, ...fetchedTechnicians]);
      setUserRoles(fetchedUserRoles);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "/" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        statusFilterRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(e.target)) {
        setShowNotificationPanel(false);
      }
    };

    if (showNotificationPanel) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotificationPanel]);

  const updateStatus = async (id, newStatus) => {
    const currentIssue = issues.find((issue) => issue.id === id);
    const previousStatus = currentIssue?.status;

    if (newStatus === APP_CONFIG.ISSUE_STATUSES.CLOSED && !window.confirm("Close this issue? You can undo this change.")) {
      return;
    }

    setLoading(true);
    await updateIssueStatus(id, newStatus);
    await loadDashboard();

    if (previousStatus && previousStatus !== newStatus) {
      setLastStatusChange({ id, previousStatus });
    }

    setFeedback(`Issue #${id} updated to ${newStatus}.`);
    setLoading(false);
  };

  const handleAssignTechnician = async (id, tech) => {
    setLoading(true);
    await assignTechnician(id, tech);
    await loadDashboard();
    setFeedback(`Technician updated for issue #${id}.`);
    setLoading(false);
  };

  const markRead = async (notificationId) => {
    await markNotificationRead(notificationId);
    await loadDashboard();
  };

  const handleReviewTechnician = async (applicationId, approve, reviewNote = "") => {
    setLoading(true);
    try {
      await reviewTechnicianApplication(applicationId, approve, reviewNote);
      await loadDashboard();
      setFeedback(approve ? "Technician application approved." : "Technician application rejected.");
    } catch (error) {
      setFeedback(error.message || "Unable to review technician application.");
    }
    setLoading(false);
  };

  const handleAddOrUpdateRole = async (event) => {
    event.preventDefault();
    if (!newUserEmail.trim()) {
      return;
    }

    setDbManagementLoading(true);
    try {
      await adminUpsertUserRole(newUserEmail.trim(), newUserRole);
      setFeedback(`Role updated for ${newUserEmail.trim()}.`);
      setNewUserEmail("");
      await loadDashboard();
    } catch (error) {
      setFeedback(error.message || "Unable to update user role.");
    }
    setDbManagementLoading(false);
  };

  const handleDeleteRole = async (email) => {
    if (!window.confirm(`Remove role mapping for ${email}?`)) {
      return;
    }

    setDbManagementLoading(true);
    try {
      await adminDeleteUserRole(email);
      setFeedback(`Removed role mapping for ${email}.`);
      await loadDashboard();
    } catch (error) {
      setFeedback(error.message || "Unable to remove role mapping.");
    }
    setDbManagementLoading(false);
  };

  const getStatusClass = (status) => {
    return `status ${getStatusBadgeClass(status)}`;
  };

  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <h2>Admin Console</h2>

        <button
          className={activeTab === "issues" ? "active-tab" : ""}
          onClick={() => setActiveTab("issues")}
        >
          Issue Operations
        </button>
        <button
          className={activeTab === "applications" ? "active-tab" : ""}
          onClick={() => setActiveTab("applications")}
        >
          Government Officer Applications {pendingApplications.length > 0 ? `(${pendingApplications.length})` : ""}
        </button>
        <button
          className={activeTab === "database" ? "active-tab" : ""}
          onClick={() => setActiveTab("database")}
        >
          Database Management
        </button>

        <button
          onClick={async () => {
            await logout();
            navigate("/");
          }}
        >
          Logout
        </button>
      </div>

      <div className="main-content">
        <div className="header">
          <div>
            <p className="breadcrumbs">Home / Admin</p>
            <h1>Admin Dashboard</h1>
            <p className="helper-text">Shortcut: press / to jump to status filter.</p>
          </div>
          {activeTab === "issues" && (
            <div className="notification-bell-container" ref={notificationPanelRef}>
              <button
                className="notification-bell"
                onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                title="View notifications"
              >
                🔔
                {unreadNotificationCount > 0 && (
                  <span className="notification-badge">{unreadNotificationCount}</span>
                )}
              </button>
              {showNotificationPanel && (
                <div className="notification-dropdown">
                  <h4>Notifications</h4>
                  {notifications.length === 0 ? (
                    <p className="no-notifications">No notifications</p>
                  ) : (
                    <ul className="notification-list">
                      {notifications.slice(0, APP_CONFIG.NOTIFICATION_DISPLAY_COUNT).map((notification) => (
                        <li
                          key={notification.id}
                          className={notification.is_read ? "notification read" : "notification unread"}
                        >
                          <div>
                            <strong>{notification.title}</strong>
                            <p>{notification.message}</p>
                          </div>
                          {!notification.is_read && (
                            <button onClick={() => markRead(notification.id)}>✓</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {feedback && <div className="feedback-banner">{feedback}</div>}

        {activeTab === "issues" && (
          <>
            <div className="metrics-row" aria-label="Admin summary">
              <article className="metric-card">
                <p>Total Issues</p>
                <strong>{metrics.total}</strong>
              </article>
              <article className="metric-card">
                <p>Pending</p>
                <strong>{metrics.pending}</strong>
              </article>
              <article className="metric-card">
                <p>In Progress</p>
                <strong>{metrics.inProgress}</strong>
              </article>
              <article className="metric-card">
                <p>Resolved / Closed</p>
                <strong>{metrics.resolved + metrics.closed}</strong>
              </article>
            </div>

            <div className="card">
              <h3>Filters</h3>
              <div className="filters-row">
                <select
                  id="filterStatus"
                  name="filterStatus"
                  ref={statusFilterRef}
                  value={filters.status}
                  onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                  aria-label="Filter by issue status"
                >
                  <option>All</option>
                  {Object.values(APP_CONFIG.ISSUE_STATUSES).map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>

                <select
                  id="filterTechnician"
                  name="filterTechnician"
                  value={filters.technician}
                  onChange={(e) => setFilters((prev) => ({ ...prev, technician: e.target.value }))}
                  aria-label="Filter by technician"
                >
                  <option>All</option>
                  {technicians.map((tech) => (
                    <option key={tech}>{tech}</option>
                  ))}
                </select>

                <select
                  id="filterCategory"
                  name="filterCategory"
                  value={filters.category}
                  onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
                  aria-label="Filter by category"
                >
                  <option>All</option>
                  {Object.values(APP_CONFIG.CATEGORIES).map((cat) => (
                    <option key={cat}>{cat}</option>
                  ))}
                </select>

                <select
                  id="filterPriority"
                  name="filterPriority"
                  value={filters.priority}
                  onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}
                  aria-label="Filter by priority"
                >
                  <option>All</option>
                  {Object.values(APP_CONFIG.PRIORITIES).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

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
                      <th>Priority</th>
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
                    {issues.map((issue) => (
                      <tr key={issue.id}>
                        <td>{issue.id}</td>
                        <td>{issue.title}</td>
                        <td>{issue.category}</td>
                        <td>{issue.priority || APP_CONFIG.PRIORITIES.MEDIUM}</td>
                        <td>{issue.location}</td>
                        <td>
                          <span className={getStatusClass(issue.status)}>{issue.status}</span>
                        </td>
                        <td>{issue.technician || APP_CONFIG.DEFAULT_NOT_ASSIGNED}</td>
                        <td>{issue.student_email}</td>
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
                                  View
                                </button>
                              ))}
                            </div>
                          ) : (
                            "No images"
                          )}
                        </td>
                        <td>
                          <select
                            id={`assignTechnician-${issue.id}`}
                            name={`assignTechnician-${issue.id}`}
                            value={issue.technician || APP_CONFIG.DEFAULT_NOT_ASSIGNED}
                            onChange={(e) => handleAssignTechnician(issue.id, e.target.value)}
                            disabled={loading}
                          >
                            {technicians.map((tech) => (
                              <option key={tech}>{tech}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            id={`changeStatus-${issue.id}`}
                            name={`changeStatus-${issue.id}`}
                            value={issue.status}
                            onChange={(e) => updateStatus(issue.id, e.target.value)}
                            disabled={loading}
                            className="status-select"
                          >
                            {Object.values(APP_CONFIG.ISSUE_STATUSES).map((status) => (
                              <option key={status}>{status}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {activeTab === "applications" && (
          <div className="card">
            <h3>Technician Registration Requests</h3>
            {techApplications.length === 0 ? (
              <p>No technician registration requests found.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Phone</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Requested At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {techApplications.map((application) => {
                    const isPending = application.status?.toLowerCase() === APP_CONFIG.TECH_APP_STATUS.PENDING;
                    return (
                      <tr key={application.id}>
                        <td>{application.full_name}</td>
                        <td>{application.email}</td>
                        <td>{application.department}</td>
                        <td>{application.phone}</td>
                        <td>{application.reason}</td>
                        <td className={`app-status ${application.status}`}>{application.status}</td>
                        <td>{new Date(application.created_at).toLocaleString()}</td>
                        <td className="review-actions">
                          <button
                            onClick={() => handleReviewTechnician(application.id, true)}
                            disabled={loading || !isPending}
                            className="btn-approve"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReviewTechnician(application.id, false)}
                            disabled={loading || !isPending}
                            className="btn-reject"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "database" && (
          <>
            <div className="card">
              <h3>Add or Update User Role</h3>
              <form onSubmit={handleAddOrUpdateRole}>
                <div className="filters-row">
                  <input
                    id="newUserEmail"
                    name="newUserEmail"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@college.edu"
                    required
                  />
                  <select id="newUserRole" name="newUserRole" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
                    <option value={APP_CONFIG.ROLES.STUDENT}>student</option>
                    <option value={APP_CONFIG.ROLES.TECHNICIAN}>technician</option>
                    <option value={APP_CONFIG.ROLES.ADMIN}>admin</option>
                  </select>
                  <button type="submit" disabled={dbManagementLoading} className="btn-primary">
                    {dbManagementLoading ? "Saving..." : "Save Role"}
                  </button>
                </div>
              </form>
            </div>

            <div className="card">
              <h3>User Role Records</h3>
              {loading || dbManagementLoading ? (
                <p>Loading role mappings...</p>
              ) : userRoles.length === 0 ? (
                <p>No role mappings found.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRoles.map((row) => (
                      <tr key={row.email}>
                        <td>{row.email}</td>
                        <td>{row.role}</td>
                        <td>
                          <button onClick={() => handleDeleteRole(row.email)} disabled={dbManagementLoading} className="btn-delete">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedImage(null)}>
              X
            </button>
            <img src={selectedImage} alt="Issue" className="modal-image" />
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;

