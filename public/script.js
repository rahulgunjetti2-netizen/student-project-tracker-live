const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const message = document.querySelector('#message');

const API_URL = '/api/projects';

// <select> value -> text shown to people AND sent to the API.
const statusLabels = {
  'planned': 'Planned',
  'in-progress': 'In Progress',
  'completed': 'Completed'
};

// API text -> <select> value (used when editing).
const labelToValue = Object.fromEntries(
  Object.entries(statusLabels).map(([value, label]) => [label, value])
);

// Temporary copy of what the API last returned. It is only used for display.
let projects = [];
let loadFailed = false; // true = the last attempt to load the list failed
let busy = false;       // true = a request is running
let editingId = null;   // null = Add mode; otherwise the server id being edited

function showMessage(text) {
  message.textContent = text;
}

function showError(error) {
  showMessage('Error: ' + error.message);
}

// Enables/disables every control that could start another request.
function setBusy(value) {
  busy = value;
  saveButton.disabled = value;
  cancelButton.disabled = value;
  projectList.querySelectorAll('button').forEach(button => {
    button.disabled = value;
  });
}

// One place for fetch. Throws an Error with a readable message on any failure.
async function apiRequest(method, url, body) {
  const options = { method: method, headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error('Could not reach the server. Check that it is running and try again.');
  }

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null; // the body was empty or not JSON
  }

  if (!response.ok) {
    const text = data && typeof data.error === 'string'
      ? data.error
      : 'The server returned an error (HTTP ' + response.status + ').';
    throw new Error(text);
  }

  return data;
}

// A row from the API is only used if it has the shape we expect.
function isValidRow(row) {
  return row !== null &&
    typeof row === 'object' &&
    Number.isSafeInteger(row.id) &&
    typeof row.name === 'string' &&
    typeof row.status === 'string';
}

// Puts the form back into Add mode.
function setAddMode() {
  editingId = null;
  form.reset();
  saveButton.textContent = 'Save project';
  cancelButton.hidden = true;
}

// Puts the form into Edit mode for one project.
function startEdit(id) {
  const project = projects.find(item => item.id === id);
  if (!project) {
    return;
  }
  editingId = id;
  nameInput.value = project.name;
  if (Object.prototype.hasOwnProperty.call(labelToValue, project.status)) {
    statusInput.value = labelToValue[project.status];
  }
  saveButton.textContent = 'Save changes';
  cancelButton.hidden = false;
  showMessage('');
  nameInput.focus();
}

// Rebuilds the whole list from the projects array.
function render() {
  projectList.textContent = '';

  projects.forEach(project => {
    const item = document.createElement('li');
    item.textContent = project.name + ' - ' + project.status + ' '; // textContent keeps user text safe
    item.dataset.id = project.id;

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.disabled = busy;
    editButton.setAttribute('aria-label', 'Edit ' + project.name);
    editButton.addEventListener('click', () => startEdit(project.id));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.disabled = busy;
    deleteButton.setAttribute('aria-label', 'Delete ' + project.name);
    deleteButton.addEventListener('click', () => deleteProject(project.id));

    item.appendChild(editButton);
    item.appendChild(document.createTextNode(' '));
    item.appendChild(deleteButton);
    projectList.appendChild(item);
  });

  if (projects.length > 0) {
    emptyState.textContent = '';
  } else if (loadFailed) {
    emptyState.textContent = 'Projects could not be loaded.'; // not the same as "empty"
  } else {
    emptyState.textContent = 'No projects yet.';
  }
}

// GET the current collection and render it.
// Returns null on success, or an Error if loading failed. It never throws.
async function loadProjects() {
  try {
    const data = await apiRequest('GET', API_URL);
    if (!Array.isArray(data) || !data.every(isValidRow)) {
      throw new Error('The server sent projects in an unexpected format.');
    }
    projects = data.map(row => ({ id: row.id, name: row.name, status: row.status }));
    loadFailed = false;

    // If the project being edited no longer exists, leave Edit mode.
    if (editingId !== null && !projects.some(item => item.id === editingId)) {
      setAddMode();
    }

    render();
    return null;
  } catch (error) {
    loadFailed = true;
    render(); // keeps any old list on screen, or shows "could not be loaded"
    return error;
  }
}

// Deletes one project after the user confirms.
async function deleteProject(id) {
  if (busy) {
    return;
  }
  const project = projects.find(item => item.id === id);
  if (!project) {
    return;
  }

  const confirmed = window.confirm('Delete "' + project.name + '" (' + project.status + ')?');
  if (!confirmed) {
    return; // Cancelled: no request, nothing changes
  }

  setBusy(true);
  showMessage('Deleting...');
  try {
    await apiRequest('DELETE', API_URL + '/' + encodeURIComponent(id));
  } catch (error) {
    showError(error);
    setBusy(false);
    return;
  }

  if (editingId === id) {
    setAddMode(); // the project being edited is gone
  }

  const reloadError = await loadProjects();
  showMessage(reloadError
    ? 'Project deleted, but the list could not be refreshed: ' + reloadError.message
    : 'Project deleted.');
  setBusy(false);
}

// The one and only submit listener: Add or Save changes.
form.addEventListener('submit', async event => {
  event.preventDefault(); // stop the browser from reloading the page

  if (busy) {
    return;
  }

  const name = nameInput.value.trim();

  if (name === '') {
    showMessage('Please enter a project name.');
    nameInput.focus();
    return;
  }
  if (name.length > 80) {
    showMessage('Please use 80 characters or fewer.');
    nameInput.focus();
    return;
  }

  const payload = { name: name, status: statusLabels[statusInput.value] };
  const id = editingId; // remember which mode this save started in
  const isEdit = id !== null;

  setBusy(true);
  showMessage('Saving...');
  try {
    if (isEdit) {
      await apiRequest('PUT', API_URL + '/' + encodeURIComponent(id), payload);
    } else {
      await apiRequest('POST', API_URL, payload);
    }
  } catch (error) {
    showError(error); // input and Edit mode stay exactly as they were
    setBusy(false);
    return;
  }

  // Success: only now do we clear the form.
  if (isEdit) {
    setAddMode();
  } else {
    nameInput.value = '';
  }

  const reloadError = await loadProjects();
  const done = isEdit ? 'Project saved.' : 'Project added.';
  showMessage(reloadError
    ? done + ' However, the list could not be refreshed: ' + reloadError.message
    : done);
  setBusy(false);
  nameInput.focus();
});

// Cancel edit: throw away unsaved changes and go back to Add mode. No request is sent.
cancelButton.addEventListener('click', () => {
  if (busy) {
    return;
  }
  showMessage('');
  setAddMode();
  nameInput.focus();
});

// Start-up: load the list from the API.
(async function init() {
  setBusy(true);
  showMessage('Loading projects...');
  emptyState.textContent = '';
  const error = await loadProjects();
  showMessage(error ? 'Error: ' + error.message : '');
  setBusy(false);
})();