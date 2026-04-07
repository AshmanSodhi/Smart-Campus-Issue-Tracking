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
import {
  APP_CONFIG,
  getIssueCategoryDepartment,
  getIssueCategoryLabel,
  getStatusBadgeClass,
  isAllowedIssueTransition,
  normalizeIssueStatus,
} from "../config/appConfig";
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

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timer = setTimeout(() => {
      setFeedback("");
    }, 4500);

    return () => clearTimeout(timer);
  }, [feedback]);

  const loadIssues = async () => {
    setLoading(true);
    const fetchedIssues = await getOfficerIssues();
    setIssues(
      (fetchedIssues || []).map((issue) => ({
        ...issue,
        status: normalizeIssueStatus(issue.status) || issue.status,
      }))
    );

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
    const nextStatus = normalizeIssueStatus(status);
    if (!nextStatus) {
      setFeedback("Invalid status selected.");
      return;
    }

    if (
      nextStatus === APP_CONFIG.ISSUE_STATUSES.PENDING &&
      normalizeIssueStatus(issue.status) !== APP_CONFIG.ISSUE_STATUSES.PENDING
    ) {
      setFeedback("Technicians cannot move issues back to Pending.");
      return;
    }

    if (nextStatus === APP_CONFIG.ISSUE_STATUSES.RESOLVED) {
      setShowSubmissionModal(issue.id);
      return;
    }

    if (nextStatus === APP_CONFIG.ISSUE_STATUSES.MORE_INFO_NEEDED) {
      setShowMoreInfoModal(issue.id);
      return;
    }

    setLoading(true);
    try {
      await updateIssueStatusSimple(issue, nextStatus);
    } finally {
      setLoading(false);
    }
  };

  const updateIssueStatusSimple = async (issue, status) => {
    if (status === APP_CONFIG.ISSUE_STATUSES.CLOSED && !window.confirm("Close this issue? You can undo this change.")) {
      return;
    }

    try {
      const updateResult = await updateIssueStatus(issue.id, status);
      if (!updateResult || updateResult.length === 0) {
        setFeedback(`Unable to move issue #${issue.id} to ${status}. Please try again.`);
        return;
      }

      await loadIssues();
      if (issue.status !== status) {
        setLastStatusChange({ id: issue.id, previousStatus: issue.status });
      }
      setFeedback(`Issue #${issue.id} moved to ${status}.`);
    } catch (error) {
      setFeedback(error.message || "Failed to update issue status.");
    }
  };

  const getAllowedStatusOptions = (currentStatus) => {
    const normalizedCurrentStatus = normalizeIssueStatus(currentStatus);
    if (!normalizedCurrentStatus) {
      return Object.values(APP_CONFIG.ISSUE_STATUSES);
    }

    return Object.values(APP_CONFIG.ISSUE_STATUSES).filter(
      (candidateStatus) =>
        // Technicians should not be able to move issues back to Pending.
        (candidateStatus === APP_CONFIG.ISSUE_STATUSES.PENDING
          ? candidateStatus === normalizedCurrentStatus
          : candidateStatus === normalizedCurrentStatus ||
            isAllowedIssueTransition(normalizedCurrentStatus, candidateStatus))
    );
  };

  const handleSubmitWork = async (issueId) => {
    const description = submissionForms[issueId]?.description || "";
    const imageFile = submissionImages[issueId];

    if (!description.trim() && !imageFile) {
      setFeedback("Please provide work description or upload completion image.");
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

      const submitResult = await submitTechnicianWork(issueId, description, imageUrl);
      if (!submitResult || submitResult.length === 0) {
        setFeedback(`Unable to submit work for issue #${issueId}. Please try again.`);
        return;
      }

      setSubmissionForms((prev) => ({ ...prev, [issueId]: { description: "" } }));
      setSubmissionImages((prev) => ({ ...prev, [issueId]: null }));
      setSubmissionPreviews((prev) => ({ ...prev, [issueId]: null }));
      setShowSubmissionModal(null);

      await loadIssues();
      setFeedback(`Work submitted for issue #${issueId}. Citizen will verify the resolution.`);
    } catch (error) {
      setFeedback(error.message || "Failed to submit work.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestMoreInfo = async (issueId) => {
    const request = moreInfoForms[issueId]?.request || "";

    if (!request.trim()) {
      setFeedback("Please provide details about what information you need.");
      return;
    }

    setLoading(true);
    try {
      const requestResult = await requestMoreInfo(issueId, request);
      if (!requestResult || requestResult.length === 0) {
        setFeedback(`Unable to request more information for issue #${issueId}.`);
        return;
      }
      setMoreInfoForms((prev) => ({ ...prev, [issueId]: { request: "" } }));
      setShowMoreInfoModal(null);
      await loadIssues();
      setFeedback(`More information requested for issue #${issueId}. Citizen will be notified.`);
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

  const markRead = async (notificationId) => {
    await markNotificationRead(notificationId);
    await loadIssues();
  };

  const getStatusClass = (status) => {
    return `status ${getStatusBadgeClass(status)}`;
  };

  const isErrorFeedback = /(unable|failed|error|invalid|cannot|please)/i.test(feedback);

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
          <div className="header admin-header">
            <div>
              <p className="breadcrumbs">Home / Officer / Assigned Issues</p>
              <h1>Government Officer Dashboard</h1>
              <p className="helper-text">Submit your work with optional completion images and request more info when needed.</p>
            </div>
            <div className="header-tools" ref={notificationPanelRef}>
              <button
                className="notification-icon-button"
                onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                title="View notifications"
              >
                <span className="notification-bell">🔔</span>
                {unreadNotificationCount > 0 && (
                  <span className="notification-badge">{unreadNotificationCount}</span>
                )}
              </button>
              {showNotificationPanel && (
                <div className="notification-popover">
                  <div className="notification-popover-header">
                    <h3>Notifications</h3>
                    {unreadNotificationCount > 0 && (
                      <span>{unreadNotificationCount} unread</span>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p className="notification-empty">No notifications</p>
                  ) : (
                    <ul className="notification-list compact">
                      {notifications.map((notification) => (
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
            <p>More Info Needed</p>
            <strong>{moreInfoCount}</strong>
          </article>
          <article className="metric-card">
            <p>Resolved / Closed</p>
            <strong>{resolvedOrClosedCount}</strong>
          </article>
        </div>

        {feedback && (
          <div className={`feedback-banner ${isErrorFeedback ? "error" : "success"}`} role="status">
            {feedback}
          </div>
        )}
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
              <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Department</th>
                  <th>Priority</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Citizen</th>
                  <th>Citizen Note</th>
                  <th>Submission Note</th>
                  <th>Citizen Feedback</th>
                  <th>Images</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.id}>
                    <td>{issue.id}</td>
                    <td>{issue.title}</td>
                    <td>{getIssueCategoryLabel(issue.category)}</td>
                    <td>{getIssueCategoryDepartment(issue.category)}</td>
                    <td>{issue.priority || APP_CONFIG.PRIORITIES.MEDIUM}</td>
                    <td>{issue.location}</td>
                    <td>
                      <span className={getStatusClass(issue.status)}>{issue.status}</span>
                    </td>
                    <td>{issue.student_email}</td>
                    <td>{issue.additional_info || "-"}</td>
                    <td>{issue.completion_note || issue.resolution_notes || "-"}</td>
                    <td>{issue.student_feedback || "-"}</td>
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
                    <td>
                      <select
                        id={`statusSelect-${issue.id}`}
                        name={`statusSelect-${issue.id}`}
                        value={normalizeIssueStatus(issue.status) || APP_CONFIG.ISSUE_STATUSES.PENDING}
                        onChange={(e) => handleStatusChange(issue, e.target.value)}
                        disabled={loading || issue.status === APP_CONFIG.ISSUE_STATUSES.CLOSED}
                        className="status-select"
                      >
                        {getAllowedStatusOptions(issue.status).map((statusOption) => (
                          <option key={statusOption} value={statusOption}>
                            {statusOption}
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
            <p>Describe the work you've completed and optionally upload a photo.</p>
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
            <h3>Request More Information</h3>
            <p>Specify what additional information or photos you need from the citizen.</p>
            <div className="form">
              <textarea
                id="moreInfoRequest"
                name="moreInfoRequest"
                placeholder="What information do you need from the citizen?"
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

              <div className="modal-buttons">
                <button onClick={() => setShowMoreInfoModal(null)} className="btn-cancel" disabled={loading}>
                  Cancel
                </button>
                <button
                  onClick={() => handleRequestMoreInfo(showMoreInfoModal)}
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Request Information"}
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
