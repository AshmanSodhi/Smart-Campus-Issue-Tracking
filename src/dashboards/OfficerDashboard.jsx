import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getIssueImages,
  getOfficerIssues,
  getNotifications,
  logout,
  markNotificationRead,
  requestMoreInfo,
  submitTechnicianWork,
  updateIssueStatus,
  uploadIssueImage,
  saveImageReference,
} from "../services/supabaseService";
import { APP_CONFIG, getStatusBadgeClass } from "../config/appConfig";
import "./admin.css";

function OfficerDashboard() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [issueImages, setIssueImages] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [lastStatusChange, setLastStatusChange] = useState(null);

  // Work submission form state
  const [submissionForms, setSubmissionForms] = useState({});
  const [submissionImages, setSubmissionImages] = useState({});
  const [submissionPreviews, setSubmissionPreviews] = useState({});
  const [showSubmissionModal, setShowSubmissionModal] = useState(null);

  // More info request form state
  const [moreInfoForms, setMoreInfoForms] = useState({});
  const [moreInfoImages, setMoreInfoImages] = useState({});
  const [moreInfoPreviews, setMoreInfoPreviews] = useState({});
  const [showMoreInfoModal, setShowMoreInfoModal] = useState(null);

  const notificationPanelRef = useRef(null);

  useEffect(() => {
    loadIssues();
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

  const loadIssues = async () => {
    setLoading(true);
    const fetchedIssues = await getOfficerIssues();
    setIssues(fetchedIssues);

    for (const issue of fetchedIssues) {
      const images = await getIssueImages(issue.id);
      setIssueImages((prev) => ({
        ...prev,
        [issue.id]: images,
      }));
    }

    const fetchedNotifications = await getNotifications();
    setNotifications(fetchedNotifications);
    const unreadCount = fetchedNotifications.filter((n) => !n.is_read).length;
    setUnreadNotificationCount(unreadCount);

    setLoading(false);
  };

  const handleStatusChange = async (issue, status) => {
    if (status === APP_CONFIG.ISSUE_STATUSES.RESOLVED) {
      setShowSubmissionModal(issue.id);
      return;
    }

    if (status === APP_CONFIG.ISSUE_STATUSES.MORE_INFO_NEEDED) {
      setShowMoreInfoModal(issue.id);
      return;
    }

    setLoading(true);
    await updateIssueStatusSimple(issue, status);
    setLoading(false);
  };

  const updateIssueStatusSimple = async (issue, status) => {
    if (status === APP_CONFIG.ISSUE_STATUSES.CLOSED && !window.confirm("Close this issue? You can undo this change.")) {
      return;
    }

    const result = await updateIssueStatus(issue.id, status);
    if (!result) {
      setFeedback(`Status change is not allowed for issue #${issue.id}.`);
      return;
    }
    await loadIssues();
    if (issue.status !== status) {
      setLastStatusChange({ id: issue.id, previousStatus: issue.status });
    }
    setFeedback(`Issue #${issue.id} moved to ${status}.`);
  };

  const handleSubmitWork = async (issueId) => {
    const description = submissionForms[issueId]?.description || "";
    const imageFile = submissionImages[issueId];

    if (!description.trim()) {
      setFeedback("Please add completion notes before marking this issue as resolved.");
      return;
    }

    setLoading(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadIssueImage(imageFile, issueId);
        if (imageUrl) {
          await saveImageReference(issueId, imageUrl);
        }
      }

      const result = await submitTechnicianWork(issueId, description, imageUrl);
      if (!result) {
        setFeedback(`Unable to submit work for issue #${issueId}.`);
        setLoading(false);
        return;
      }

      setSubmissionForms((prev) => ({ ...prev, [issueId]: { description: "" } }));
      setSubmissionImages((prev) => ({ ...prev, [issueId]: null }));
      setSubmissionPreviews((prev) => ({ ...prev, [issueId]: null }));
      setShowSubmissionModal(null);

      await loadIssues();
      setFeedback(`Work submitted for issue #${issueId}. Student will verify the resolution.`);
    } catch (error) {
      setFeedback(error.message || "Failed to submit work.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestMoreInfo = async (issueId) => {
    const request = moreInfoForms[issueId]?.request || "";
    const imageFile = moreInfoImages[issueId];

    if (!request.trim()) {
      setFeedback("Please provide details about what information you need.");
      return;
    }

    setLoading(true);
    try {
      if (imageFile) {
        const imageUrl = await uploadIssueImage(imageFile, issueId);
        if (imageUrl) {
          await saveImageReference(issueId, imageUrl);
        }
      }

      const result = await requestMoreInfo(issueId, request.trim());
      if (!result) {
        setFeedback(`Unable to request more information for issue #${issueId}.`);
        setLoading(false);
        return;
      }

      setMoreInfoForms((prev) => ({ ...prev, [issueId]: { request: "" } }));
      setMoreInfoImages((prev) => ({ ...prev, [issueId]: null }));
      setMoreInfoPreviews((prev) => ({ ...prev, [issueId]: null }));
      setShowMoreInfoModal(null);
      await loadIssues();
      setFeedback(`More information requested for issue #${issueId}. Student will be notified.`);
    } catch (error) {
      setFeedback(error.message || "Failed to request more information.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmissionImageSelect = (e, issueId) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    if (file.size > APP_CONFIG.MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setFeedback(`Image size exceeds ${APP_CONFIG.MAX_IMAGE_SIZE_MB}MB limit.`);
      return;
    }

    if (!APP_CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setFeedback("Please upload a valid image (JPEG, PNG, or WebP).");
      return;
    }

    setSubmissionImages((prev) => ({ ...prev, [issueId]: file }));
    const reader = new FileReader();
    reader.onload = (event) => {
      setSubmissionPreviews((prev) => ({ ...prev, [issueId]: event.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleMoreInfoImageSelect = (e, issueId) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    if (file.size > APP_CONFIG.MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setFeedback(`Image size exceeds ${APP_CONFIG.MAX_IMAGE_SIZE_MB}MB limit.`);
      return;
    }

    if (!APP_CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setFeedback("Please upload a valid image (JPEG, PNG, or WebP).");
      return;
    }

    setMoreInfoImages((prev) => ({ ...prev, [issueId]: file }));
    const reader = new FileReader();
    reader.onload = (event) => {
      setMoreInfoPreviews((prev) => ({ ...prev, [issueId]: event.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const markRead = async (notificationId) => {
    await markNotificationRead(notificationId);
    await loadIssues();
  };

  const getStatusClass = (status) => {
    return `status ${getStatusBadgeClass(status)}`;
  };

  const getOfficerStatusOptions = (status) => {
    const transitions = APP_CONFIG.ISSUE_TRANSITIONS[status] || [];
    const officerTargets = [APP_CONFIG.ISSUE_STATUSES.MORE_INFO_NEEDED, APP_CONFIG.ISSUE_STATUSES.RESOLVED];
    const allowedTargets = transitions.filter((nextStatus) => officerTargets.includes(nextStatus));
    return [status, ...allowedTargets];
  };

  const getOfficerStatusLabel = (status) => {
    if (status === APP_CONFIG.ISSUE_STATUSES.MORE_INFO_NEEDED) {
      return "Completed";
    }
    return status;
  };

  const renderIssueNotes = (issue) => {
    const notes = [
      issue.more_info_request
        ? { label: "Request", value: issue.more_info_request }
        : null,
      issue.additional_info
        ? { label: "Citizen", value: issue.additional_info }
        : null,
      issue.resolution_notes
        ? { label: "Work", value: issue.resolution_notes }
        : null,
    ].filter(Boolean);

    if (!notes.length) {
      return "-";
    }

    return (
      <div className="issue-notes">
        {notes.map((note, index) => (
          <p className="issue-note" key={`${issue.id}-${note.label}-${index}`}>
            <strong>{note.label}:</strong> {note.value}
          </p>
        ))}
      </div>
    );
  };

  const pendingCount = issues.filter((issue) => issue.status === APP_CONFIG.ISSUE_STATUSES.PENDING).length;
  const inProgressCount = issues.filter((issue) => issue.status === APP_CONFIG.ISSUE_STATUSES.IN_PROGRESS).length;
  const moreInfoCount = issues.filter((issue) => issue.status === APP_CONFIG.ISSUE_STATUSES.MORE_INFO_NEEDED).length;
  const resolvedOrClosedCount = issues.filter(
    (issue) =>
      issue.status === APP_CONFIG.ISSUE_STATUSES.RESOLVED || issue.status === APP_CONFIG.ISSUE_STATUSES.CLOSED
  ).length;

  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <h2>Government Officer Console</h2>
        <button>Assigned Queue</button>
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
          <div className="header-main">
            <p className="breadcrumbs">Home / Technician / Assigned Issues</p>
            <h1>Technician Dashboard</h1>
            <p className="helper-text">Submit your work with optional completion images and request more info when needed.</p>
          </div>
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
        </div>

        <div className="metrics-row" aria-label="Officer summary">
          <article className="metric-card">
            <p>Assigned</p>
            <strong>{issues.length}</strong>
          </article>
          <article className="metric-card">
            <p>Pending</p>
            <strong>{pendingCount}</strong>
          </article>
          <article className="metric-card">
            <p>In Progress</p>
            <strong>{inProgressCount}</strong>
          </article>
          <article className="metric-card">
            <p>Completed</p>
            <strong>{moreInfoCount}</strong>
          </article>
          <article className="metric-card">
            <p>Resolved / Closed</p>
            <strong>{resolvedOrClosedCount}</strong>
          </article>
        </div>

        {feedback && <div className="feedback-banner" role="status">{feedback}</div>}
        {lastStatusChange && (
          <div className="feedback-banner warning" role="status">
            Last update can be reversed. (Feature coming soon)
          </div>
        )}

        <div className="card">
          <h3>My Assigned Issues</h3>
          {loading ? (
            <p>Loading issues...</p>
          ) : issues.length === 0 ? (
            <p>No issues assigned yet.</p>
          ) : (
            <div className="table-scroll">
              <table className="issues-table officer-issues-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Citizen</th>
                    <th>Images</th>
                    <th>Latest Notes</th>
                    <th>Actions</th>
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
                        <span className={getStatusClass(issue.status)}>{getOfficerStatusLabel(issue.status)}</span>
                      </td>
                      <td>{issue.student_email}</td>
                      <td>
                        {issueImages[issue.id] && issueImages[issue.id].length > 0 ? (
                          <div className="image-gallery">
                            {issueImages[issue.id].map((img, idx) => (
                              <button
                                key={idx}
                                onClick={() => setSelectedImage(img.image_url)}
                                className="image-link"
                              >
                                View
                              </button>
                            ))}
                          </div>
                        ) : (
                          "No images"
                        )}
                      </td>
                      <td>{renderIssueNotes(issue)}</td>
                      <td>
                        <select
                          id={`statusSelect-${issue.id}`}
                          name={`statusSelect-${issue.id}`}
                          value={issue.status}
                          onChange={(e) => handleStatusChange(issue, e.target.value)}
                          disabled={
                            loading ||
                            issue.status === APP_CONFIG.ISSUE_STATUSES.CLOSED ||
                            getOfficerStatusOptions(issue.status).length <= 1
                          }
                          className="status-select"
                        >
                          {getOfficerStatusOptions(issue.status).map((statusOption) => (
                            <option key={statusOption} value={statusOption}>
                              {getOfficerStatusLabel(statusOption)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Work Submission Modal */}
      {showSubmissionModal && (
        <div className="modal-overlay" onClick={() => setShowSubmissionModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowSubmissionModal(null)}>
              X
            </button>
            <h3>Submit Work Completion</h3>
            <p>Add completion notes (required) and optionally upload a photo.</p>
            <div className="form">
              <textarea
                id="workCompletionDescription"
                name="workCompletionDescription"
                placeholder="Describe the work completed..."
                value={submissionForms[showSubmissionModal]?.description || ""}
                onChange={(e) =>
                  setSubmissionForms((prev) => ({
                    ...prev,
                    [showSubmissionModal]: { description: e.target.value },
                  }))
                }
                disabled={loading}
                rows="5"
              />

              <div className="image-upload-section">
                <label htmlFor="workCompletionImage">Upload Completion Photo (Optional):</label>
                <input
                  id="workCompletionImage"
                  name="workCompletionImage"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleSubmissionImageSelect(e, showSubmissionModal)}
                  disabled={loading}
                />

                {submissionPreviews[showSubmissionModal] && (
                  <div className="image-preview">
                    <img src={submissionPreviews[showSubmissionModal]} alt="Preview" />
                  </div>
                )}
              </div>

              <div className="modal-buttons">
                <button onClick={() => setShowSubmissionModal(null)} className="btn-cancel" disabled={loading}>
                  Cancel
                </button>
                <button
                  onClick={() => handleSubmitWork(showSubmissionModal)}
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? "Submitting..." : "Submit Work"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* More Info Request Modal */}
      {showMoreInfoModal && (
        <div className="modal-overlay" onClick={() => setShowMoreInfoModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowMoreInfoModal(null)}>
              X
            </button>
            <h3>Mark as Completed</h3>
            <p>Add what the citizen should share next. This update will be sent back to the citizen.</p>
            <div className="form">
              <textarea
                id="moreInfoRequest"
                name="moreInfoRequest"
                placeholder="Add completion note or specify the additional details needed from the citizen"
                value={moreInfoForms[showMoreInfoModal]?.request || ""}
                onChange={(e) =>
                  setMoreInfoForms((prev) => ({
                    ...prev,
                    [showMoreInfoModal]: { request: e.target.value },
                  }))
                }
                disabled={loading}
                rows="5"
              />

              <div className="image-upload-section">
                <label htmlFor="moreInfoRequestImage">Upload Reference Photo (Optional):</label>
                <input
                  id="moreInfoRequestImage"
                  name="moreInfoRequestImage"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleMoreInfoImageSelect(e, showMoreInfoModal)}
                  disabled={loading}
                />

                {moreInfoPreviews[showMoreInfoModal] && (
                  <div className="image-preview">
                    <img src={moreInfoPreviews[showMoreInfoModal]} alt="Request reference preview" />
                  </div>
                )}
              </div>

              <div className="modal-buttons">
                <button onClick={() => setShowMoreInfoModal(null)} className="btn-cancel" disabled={loading}>
                  Cancel
                </button>
                <button
                  onClick={() => handleRequestMoreInfo(showMoreInfoModal)}
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Mark Completed"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image View Modal */}
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

export default OfficerDashboard;
