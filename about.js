// about.js: Consolidated about page functionality
import {escapeHtml} from "./utils.js";

// ============================================================================
// CENSUS DATA MANAGEMENT
// ============================================================================

let interestsData = [];
let filteredData = [];
let currentSort = {column: 'interest', direction: 'asc'};
let interestsLoaded = false;
let interests2025Loaded = false;
let interests2020Loaded = false;
let donationsLoaded = false;
let machinesLoaded = false;
let interests2025Data = [];
let interests2020Data = [];
let donationsData = [];
let machinesData = [];

// Google Sheets URLs
const SHEETS_URL = 'https://docs.google.com/spreadsheets/d/1T25WAAJekQAjrU-dhVtDFgiIqJHHlaGIOySToTWrrp8/edit?gid=1977273024#gid=1977273024';
const CSV_URL = SHEETS_URL.replace('/edit?gid=', '/export?format=csv&gid=');

// ============================================================================
// CSV PARSING
// ============================================================================

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result.map(val => val.replace(/^"|"$/g, ''));
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length >= 2) {
            const row = {
                interest: values[0] || '',
                members: values[1] || '0',
                category: 'Gaming',
                description: ``
            };

            const players = [];
            for (let j = 2; j < values.length; j++) {
                if (values[j] && values[j].trim() !== '') {
                    players.push(headers[j] || `Player ${j}`);
                }
            }

            if (players.length > 0) {
                row.description += `Users: ${players.join(', ')}`;
            }

            if (row.interest && row.interest.trim() !== '') {
                data.push(row);
            }
        }
    }

    return data;
}

function parseDonationsCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, idx) => {
            row[header] = values[idx] || '';
        });
        data.push({
            expense: row['expense'] || row['expenses'] || '',
            cost: row['cost'] || '',
            description: row['description'] || '',
            donor: row['donor'] || row['donation'] || row['donations'] || ''
        });
    }
    return data;
}

function parseMachinesCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, idx) => {
            row[header] = values[idx] || '';
        });
        data.push({
            name: row['machine name'] || row['name'] || '',
            owner: row['owner'] || '',
            location: row['location'] || '',
            purpose: row['purpose'] || '',
            internalId: row['s# (internal)'] || row['internalid'] || '',
            notes: row['notes'] || ''
        });
    }
    return data;
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadAllCensusTables() {
    await Promise.all([
        loadInterests2025(),
        loadInterests2020(),
        loadDonations(),
        loadMachines()
    ]);
}

async function loadInterests2025() {
    if (interests2025Loaded) return;
    const url = 'https://docs.google.com/spreadsheets/d/1T25WAAJekQAjrU-dhVtDFgiIqJHHlaGIOySToTWrrp8/export?format=csv&gid=1977273024';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch 2025 interests');
        const csvText = await response.text();
        interests2025Data = parseCSV(csvText);
        interests2025Loaded = true;
        renderInterests2025Table();
    } catch (e) {
        console.error(e);
    }
}

async function loadInterests2020() {
    if (interests2020Loaded) return;
    const url = 'https://docs.google.com/spreadsheets/d/1T25WAAJekQAjrU-dhVtDFgiIqJHHlaGIOySToTWrrp8/export?format=csv&gid=0';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch 2020 interests');
        const csvText = await response.text();
        interests2020Data = parseCSV(csvText);
        interests2020Loaded = true;
        renderInterests2020Table();
    } catch (e) {
        console.error(e);
    }
}

async function loadDonations() {
    if (donationsLoaded) return;
    const url = 'https://docs.google.com/spreadsheets/d/1T25WAAJekQAjrU-dhVtDFgiIqJHHlaGIOySToTWrrp8/export?format=csv&gid=759735980';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch donations');
        const csvText = await response.text();
        donationsData = parseDonationsCSV(csvText);
        donationsLoaded = true;
        console.log('Parsed Donations:', donationsData);
        renderDonationsTable();
    } catch (e) {
        console.error(e);
    }
}

async function loadMachines() {
    if (machinesLoaded) return;
    const url = 'https://docs.google.com/spreadsheets/d/1T25WAAJekQAjrU-dhVtDFgiIqJHHlaGIOySToTWrrp8/export?format=csv&gid=752318281';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch machines');
        const csvText = await response.text();
        machinesData = parseMachinesCSV(csvText);
        machinesLoaded = true;
        console.log('Parsed Machines:', machinesData);
        renderMachinesTable();
    } catch (e) {
        console.error(e);
    }
}

// ============================================================================
// TABLE RENDERING
// ============================================================================

function renderTable(tbodyId, data, columns, noResultsId) {
    const tbody = document.getElementById(tbodyId);
    const noResults = document.getElementById(noResultsId);

    if (!tbody) return;

    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        if (noResults) noResults.classList.remove('hidden');
        return;
    }

    if (noResults) noResults.classList.add('hidden');

    data.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'text-text-primary border-t border-table-td-border hover:bg-table-row-hover-bg';

        const cells = columns.map(col => {
            const value = item[col.key] || '';
            return `<td class="px-6 py-4 text-left">${escapeHtml(value)}</td>`;
        }).join('');

        row.innerHTML = cells;
        tbody.appendChild(row);
    });
}

function renderInterests2025Table() {
    const columns = [
        {key: 'interest'},
        {key: 'category'},
        {key: 'members'},
        {key: 'description'}
    ];
    renderTable('interests-table-body', interests2025Data, columns, 'interests-no-results');
}

function renderInterests2020Table() {
    const columns = [
        {key: 'interest'},
        {key: 'category'},
        {key: 'members'},
        {key: 'description'}
    ];
    renderTable('interests-2020-table-body', interests2020Data, columns, 'interests-2020-no-results');
}

function renderDonationsTable() {
    const columns = [
        {key: 'expense'},
        {key: 'cost'},
        {key: 'description'},
        {key: 'donor'}
    ];
    renderTable('donations-table-body', donationsData, columns, 'donations-no-results');
}

function renderMachinesTable() {
    const columns = [
        {key: 'name'},
        {key: 'owner'},
        {key: 'location'},
        {key: 'purpose'},
        {key: 'internalId'},
        {key: 'notes'}
    ];
    renderTable('machines-table-body', machinesData, columns, 'machines-no-results');
}

// ============================================================================
// SORTING
// ============================================================================

function sortData(data, column, direction) {
    return data.sort((a, b) => {
        let aVal = a[column] || '';
        let bVal = b[column] || '';

        if (column === 'members') {
            aVal = parseInt(aVal) || 0;
            bVal = parseInt(bVal) || 0;
        } else {
            aVal = aVal.toString().toLowerCase();
            bVal = bVal.toString().toLowerCase();
        }

        if (direction === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
}

// Global sort functions
window.sortTable2025 = function (column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }

    interests2025Data = sortData(interests2025Data, column, currentSort.direction);
    renderInterests2025Table();
};

window.sortTable2020 = function (column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }

    interests2020Data = sortData(interests2020Data, column, currentSort.direction);
    renderInterests2020Table();
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initializeAboutPage() {
    // Setup census group tabs
    const groupTabButtons = document.querySelectorAll('.census-group-tab-btn');
    const groupTables = document.querySelectorAll('.census-group-table');

    groupTabButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            groupTabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            groupTables.forEach(table => table.classList.add('hidden'));

            const group = btn.getAttribute('data-group');
            const showTable = document.getElementById('census-group-' + group);
            if (showTable) showTable.classList.remove('hidden');

            if (group === '2025') renderInterests2025Table();
            else if (group === '2020') renderInterests2020Table();
            else if (group === 'donations') renderDonationsTable();
            else if (group === 'machines') renderMachinesTable();
        });
    });

    // Setup census tab click handler
    const censusTab = document.getElementById('tab-census');
    if (censusTab) {
        censusTab.addEventListener('click', function () {
            if (!interestsLoaded) {
                loadAllCensusTables();
                interestsLoaded = true;
            }
        });
    }

    // Check if we're already on census tab
    if (window.location.hash === '#census') {
        loadAllCensusTables();
        interestsLoaded = true;
    }
}