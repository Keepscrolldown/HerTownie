/* ================= GLOBAL CONFIG ================= */
const API_URL = "http://localhost:5000"; // Fixed to your backend port
const PRODUCT_API = `${API_URL}/api/products`;
const ORDER_API = `${API_URL}/api/orders`;
const COUPON_API = `${API_URL}/api/coupons`;
const CATEGORY_API = `${API_URL}/api/categories`;

/* ================= SESSION MANAGEMENT ================= */
function getAuthHeader() {
    const token = sessionStorage.getItem("adminToken");
    return token ? { "Authorization": `Bearer ${token}` } : {};
}

function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.innerText = message;

    toast.className = `
        fixed bottom-6 right-6 px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-widest shadow-xl z-[9999]
        ${type === "error" ? "bg-red-500 text-white" : "bg-black text-white"}
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function checkSession() {
    const token = sessionStorage.getItem("adminToken");
    const expiry = sessionStorage.getItem("adminExpiry");
    const now = Date.now();

    if (!token || !expiry || now > expiry) {
        adminLogout();
        return false;
    }
    return true;
}

function adminLogout() {
    sessionStorage.clear();
    window.location.replace("admin-login.html");
}

/* ================= PAGE LOAD INITIALIZATION ================= */
document.addEventListener("DOMContentLoaded", () => {
    if (!checkSession()) return;

    // Initial Dashboard Data
    loadInsights();

    // Contextual Data Fetch based on active elements
    if (document.getElementById("admin-product-list")) {
        fetchProducts();
        fetchCategories();
    }
    if (document.getElementById("admin-orders-list")) fetchOrders();
    if (document.getElementById("admin-coupon-list")) fetchCoupons();

    // Form Submissions
    setupFormListener("edit-product-form", updateProduct);
    setupFormListener("product-form", saveProduct);
    setupFormListener("coupon-form", saveCoupon);

    // Auto-refresh stats every 60 seconds
    setInterval(loadInsights, 60000);
});

function setupFormListener(id, action) {
    const form = document.getElementById(id);
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;
            await action(e);
            if (submitBtn) submitBtn.disabled = false;
        };
    }
}

// Global listener for Invoice buttons
document.addEventListener("click", (e) => {
    const btn = e.target.closest(".invoice-btn");
    if (!btn) return;

    const rawOrder = btn._orderData;

    if (!rawOrder) {
        alert("Order data not found. Please refresh.");
        return;
    }

    try {
        // SAFER FORMATTING: Check if shippingDetails exists first
        if (!rawOrder.shippingDetails) {
            rawOrder.shippingDetails = {
                firstName: rawOrder.userId?.firstName || "Customer",
                lastName: rawOrder.userId?.lastName || "",
                address: "N/A",
                city: "N/A",
                state: "N/A",
                pincode: "N/A",
                phone: "N/A"
            };
        }

        generateInvoice(rawOrder);
    } catch (err) {
        console.error("Invoice Generation Error:", err);
        alert("Could not process invoice: " + err.message);
    }
});

/* ================= MODAL CONTROLS ================= */
const toggleModal = (id, show) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    show ? modal.classList.add('show') : modal.classList.remove('show');
    if (id === 'orderModal') modal.style.display = show ? "flex" : "none";
};

/* ================= INSIGHTS & STATS ================= */
async function loadInsights() {
    try {
        const headers = getAuthHeader();
        const [prodRes, orderRes, couponRes] = await Promise.all([
            fetch(PRODUCT_API), // Public
            fetch(ORDER_API, { headers }), // Protected
            fetch(COUPON_API, { headers }) // Protected
        ]);

        const products = await prodRes.json();
        const orders = await orderRes.json();
        const coupons = await couponRes.json();

        // Safety check: if backend returns error object instead of array
        const safeOrders = Array.isArray(orders) ? orders : [];
        const safeProducts = Array.isArray(products) ? products : [];
        const safeCoupons = Array.isArray(coupons) ? coupons : [];

        // 1. Revenue
        const totalRevenue = safeOrders.reduce((sum, order) => sum + (order.total || 0), 0);

        // 2. Stock
        const totalStock = safeProducts.reduce((sum, p) => sum + (p.stock || 0), 0);

        // 3. Today's Orders
        const todayStr = new Date().toDateString();
        const todayOrders = safeOrders.filter(o => new Date(o.createdAt).toDateString() === todayStr).length;

        // 4. Categories
        const categoriesCount = new Set(safeProducts.map(p => p.category)).size;

        // Update UI Elements
        updateElementText('stat-total-revenue', `₹${totalRevenue.toLocaleString('en-IN')}`);
        updateElementText('stat-today-orders', todayOrders);
        updateElementText('stat-total-orders', safeOrders.length);
        updateElementText('stat-total-stock', totalStock);
        updateElementText('stat-total-categories', categoriesCount);
        updateElementText('stat-total-coupons', safeCoupons.length);

    } catch (err) {
        console.error("Insight Sync Error:", err);
    }
}

function updateElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

/* ================= PRODUCT ACTIONS ================= */
async function fetchProducts() {
    const tbody = document.getElementById("admin-product-list");
    if (!tbody) return;

    try {
        const res = await fetch(PRODUCT_API);
        const products = await res.json();

        tbody.innerHTML = products.map(p => {
            const safeName = p.name.replace(/'/g, "\\'");
            // Use p.images[0] because your schema stores an array
            const displayImage = p.images && p.images.length > 0 ? p.images[0] : p.image;

            return `
         <tr class="border-b hover:bg-zinc-50 transition-colors">
        <td class="p-5"><img src="${displayImage}" class="h-12 w-12 object-cover border rounded-lg" /></td>
        <td class="p-5">
            <p class="font-bold text-sm text-zinc-900">${p.name}</p>
            <p class="text-[9px] text-zinc-400 uppercase font-black tracking-tighter">
            ${p.category?.name || 'Uncategorized'}
            </p>        </td>
        <td class="p-5 font-black text-sm">₹${p.price.toLocaleString('en-IN')}</td>
        <td class="p-5"><span class="text-xs font-bold ${p.stock <= 5 ? 'text-red-500' : 'text-zinc-600'}">${p.stock}</span></td>
        <td class="p-5 text-right">
            <button onclick="openEditModal('${p._id}','${safeName}','${p.category?._id || ''}','${p.price}','${displayImage}','${p.stock}')" 
                    class="text-indigo-600 text-[10px] font-black uppercase hover:underline mr-3">Edit</button>
            <button onclick="deleteProduct('${p._id}')" class="text-red-400 text-[10px] font-black uppercase hover:text-red-600">Delete</button>
        </td>
    </tr>`;
        }).join("");
    } catch (err) { tbody.innerHTML = `<td class="p-5 text-red-500">Error loading products</td>`; }
}

async function fetchCategories() {
    try {
        const res = await fetch(CATEGORY_API);
        const categories = await res.json();

        // Map options using cat._id as the VALUE
        const options = categories.map(cat =>
            `<option value="${cat._id}">${cat.name}</option>`
        ).join('');

        const select = document.getElementById('p-category');
        const editSelect = document.getElementById('edit-p-category');

        if (select) select.innerHTML = options;
        if (editSelect) editSelect.innerHTML = options;
    } catch (err) {
        console.error("Category Fetch Error:", err);
    }
}

// Inside admin-dashboard.js
function openEditModal(id, name, categoryId, price, image, stock) {
    document.getElementById("edit-p-id").value = id;
    document.getElementById("edit-p-name").value = name;

    // Use categoryId here, not the name string
    const categorySelect = document.getElementById("edit-p-category");
    if (categorySelect) categorySelect.value = categoryId;

    document.getElementById("edit-p-price").value = price;
    document.getElementById("edit-p-stock").value = stock;
    document.getElementById("edit-p-image").value = image;
    toggleModal('edit-modal', true);
}

async function updateProduct() {
    const id = document.getElementById("edit-p-id").value;

    const data = {
        name: document.getElementById("edit-p-name").value.trim(),
        price: Number(document.getElementById("edit-p-price").value),
        stock: Number(document.getElementById("edit-p-stock").value),
        description: document.getElementById("edit-p-desc")?.value || "",
        images: [document.getElementById("edit-p-image").value], // Must be array
        category: document.getElementById("edit-p-category").value, // Must be ObjectId
        featured: document.getElementById("edit-p-featured")?.checked || false
    };

    try {
        const res = await fetch(`${PRODUCT_API}/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...getAuthHeader() },
            body: JSON.stringify(data)
        });

        const result = await res.json();

        if (res.ok) {
            showToast("Product updated successfully");
            fetchProducts();
            loadInsights();
            toggleModal('edit-modal', false);
        } else {
            showToast(result.error || result.message, "error");
        }
    } catch (err) {
        alert("Network error: Could not reach server.");
    }
}
async function saveProduct(e) {
    e.preventDefault();

    // Construct data to match your Mongoose Schema
    const data = {
        name: document.getElementById("p-name").value.trim(),
        price: Number(document.getElementById("p-price").value),
        stock: Number(document.getElementById("p-stock").value),
        description: document.getElementById("p-desc")?.value || "",
        images: [document.getElementById("p-image").value], // Schema expects Array [String]
        category: document.getElementById("p-category").value, // Must be the Category _id
        featured: document.getElementById("p-featured")?.checked || false
    };

    try {
        const res = await fetch(PRODUCT_API, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeader() },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            alert("Product Added successfully!");
            document.getElementById("product-form").reset();
            toggleModal('product-modal', false);
            fetchProducts();
        } else {
            const err = await res.json();
            alert("Save failed: " + err.error);
        }
    } catch (err) {
        console.error("Save Error:", err);
    }
}
async function deleteProduct(id) {
    if (!confirm("Are you sure?")) return;
    const res = await fetch(`${PRODUCT_API}/${id}`, {
        method: "DELETE",
        headers: getAuthHeader()
    });
    if (res.ok) { fetchProducts(); loadInsights(); }
}

/* ================= ORDER ACTIONS ================= */
async function fetchOrders() {
    const tbody = document.getElementById("admin-orders-list");
    if (!tbody) return;

    try {
        const res = await fetch(ORDER_API, { headers: getAuthHeader() });
        if (res.status === 401) return adminLogout();
        const orders = await res.json();

        // Inside fetchOrders() map function
        tbody.innerHTML = orders.map(order => {
            const customerName = order.userId ? `${order.userId.firstName} ${order.userId.lastName}` : "Guest Customer";

            // Define available statuses
            const statuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

            return `
    <tr class="border-b hover:bg-zinc-50 transition-colors">
        <td class="p-5 font-mono text-[10px] text-zinc-400">#${order._id.slice(-6).toUpperCase()}</td>
        <td class="p-5 font-bold text-sm">${customerName}</td>
        <td class="p-5 font-black text-sm">₹${order.total.toLocaleString('en-IN')}</td>
        <td class="p-5">
            <select onchange="updateOrderStatus('${order._id}', this.value)" 
                class="text-[10px] font-black uppercase border rounded px-2 py-1 bg-white cursor-pointer 
                ${order.status === 'Cancelled' ? 'text-red-500 border-red-200' : 'text-zinc-700 border-zinc-200'}">
                ${statuses.map(s => `
                    <option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>
                `).join('')}
            </select>
        </td>
        <td class="p-5 text-right flex items-center justify-end">
            <button class="invoice-btn bg-zinc-950 text-white text-[9px] font-black uppercase px-3 py-2 rounded-md" 
                    data-order-id="${order._id}">
                Invoice
            </button>
            <button onclick="deleteOrder('${order._id}')" 
                    class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </td>
    </tr>`;
        }).join("");
        // Attach the actual data objects to the buttons directly to avoid JSON string issues
        document.querySelectorAll('.invoice-btn').forEach((btn, index) => {
            btn._orderData = orders[index];
        });

    } catch (err) {
        console.error("Order Sync Error:", err);
        tbody.innerHTML = `<td colspan="5" class="p-5 text-red-500 text-center">Error loading orders.</td>`;
    }
}

/* ================= INVOICE GENERATOR ================= */
function generateInvoice(order) {
    if (!order || !order.shippingDetails || !order.items) {
        console.error("Incomplete Order Data:", order);
        alert("Error: Order data is incomplete. Try refreshing the page.");
        return;
    }

    const invWindow = window.open('', '_blank');

    // GST Calculations
    const subtotal = order.total / 1.18;
    const totalGst = order.total - subtotal;
    const cgst = totalGst / 2;
    const sgst = totalGst / 2;
    const invId = `INV-${order._id.slice(-6).toUpperCase()}`;

    invWindow.document.write(`
        <html>
        <head>
            <title>HERTOWNIE Invoice - ${invId}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body class="p-6 bg-gray-50 text-gray-800">
            <div class="max-w-3xl mx-auto bg-white border shadow-sm p-10 relative">
                <div class="flex justify-between items-start border-b pb-6 mb-6">
                    <div>
                        <h1 class="text-4xl font-black text-black tracking-tighter">HERTOWNIE</h1>
                        <p class="text-xs text-gray-400 uppercase tracking-widest font-bold">Official Purchase Invoice</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-lg">${invId}</p>
                        <p class="text-sm text-gray-500">Date: ${new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-8 mb-8">
                    <div>
                        <p class="text-xs font-bold uppercase text-zinc-400 mb-1">Bill & Ship To:</p>
                        <p class="font-bold text-lg">${order.shippingDetails.firstName} ${order.shippingDetails.lastName}</p>
                        <p class="text-sm text-zinc-600">${order.shippingDetails.address}</p>
                        <p class="text-sm text-zinc-600">${order.shippingDetails.city}, ${order.shippingDetails.state} - ${order.shippingDetails.pincode}</p>
                        <p class="text-sm font-bold mt-2">📞 +91 ${order.shippingDetails.phone}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs font-bold uppercase text-zinc-400 mb-1">Payment Method:</p>
                        <p class="font-bold uppercase text-sm">${order.paymentMethod}</p>
                    </div>
                </div>

                <table class="w-full mb-8">
                    <thead>
                        <tr class="bg-zinc-100 text-left">
                            <th class="py-3 px-2 text-xs font-black uppercase">Product Description</th>
                            <th class="py-3 px-2 text-xs font-black uppercase text-center">Qty</th>
                            <th class="py-3 px-2 text-xs font-black uppercase text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${order.items.map(item => `
                            <tr class="border-b">
                                <td class="py-4 px-2">
                                    <p class="font-bold text-sm text-zinc-900">${item.name}</p>
                                    <p class="text-[10px] mt-1">
                                        <span class="bg-zinc-900 text-white px-1.5 py-0.5 rounded font-black uppercase">
                                            Size: ${item.size || item.selectedSize || item.variant || item.selected || 'N/A'}
                                        </span>
                                    </p>
                                </td>
                                <td class="py-4 px-2 text-center text-sm font-medium">${item.quantity}</td>
                                <td class="py-4 px-2 text-right text-sm font-bold">₹${(item.price * item.quantity).toLocaleString('en-IN')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="flex justify-end">
                    <div class="w-64 space-y-2">
                        <div class="flex justify-between text-sm text-zinc-500 font-medium">
                            <span>Subtotal:</span>
                            <span>₹${subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div class="flex justify-between text-sm text-zinc-500 font-medium">
                            <span>GST (18%):</span>
                            <span>₹${totalGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div class="flex justify-between border-t border-zinc-950 pt-2 text-xl font-black text-zinc-950">
                            <span>Total:</span>
                            <span>₹${order.total.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>

                <div class="mt-20 text-center border-t border-dashed pt-6 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                    <p>Thank you for choosing HERTOWNIE</p>
                    <p class="mt-1">This is a system generated invoice.</p>
                </div>

                <div class="mt-10 flex justify-center no-print">
                    <button onclick="window.print()" class="bg-zinc-950 text-white px-10 py-3 rounded-full text-xs font-black tracking-widest hover:scale-105 transition-transform shadow-xl uppercase">
                        Print Invoice
                    </button>
                </div>
            </div>
        </body>
        </html>
    `);
    invWindow.document.close();
}
/* ================= COUPON ACTIONS ================= */
async function fetchCoupons() {
    const tbody = document.getElementById("admin-coupon-list");
    if (!tbody) return;

    try {
        const res = await fetch(COUPON_API, { headers: getAuthHeader() });
        const coupons = await res.json();

        if (!Array.isArray(coupons) || coupons.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-zinc-400">No coupons active.</td></tr>`;
            return;
        }

        tbody.innerHTML = coupons.map(c => `
            <tr class="border-b hover:bg-zinc-50 transition-colors">
                <td class="p-5 font-black text-indigo-600 tracking-widest uppercase">${c.code}</td>
                <td class="p-5 font-bold text-sm">${c.type === 'percent' ? c.value + '%' : '₹' + c.value}</td>
                <td class="p-5 text-zinc-500 font-bold">₹${c.minOrder || 0}</td>
                <td class="p-5 text-[10px] font-black text-zinc-400 uppercase">${new Date(c.expiryDate).toLocaleDateString('en-GB')}</td>
                <td class="p-5 text-right">
                    <button onclick="deleteCoupon('${c._id}')" class="text-red-400 hover:text-red-600 font-black text-[10px] uppercase">Delete</button>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        console.error("Fetch Coupons Error:", err);
    }
}

async function saveCoupon(e) {
    e.preventDefault(); // Prevents page reload

    const data = {
        code: document.getElementById("c-code").value.toUpperCase().trim(),
        type: document.getElementById("c-type").value,
        value: Number(document.getElementById("c-value").value),
        minOrder: Number(document.getElementById("c-minOrder").value) || 0,
        maxdiscount: Number(document.getElementById("c-maxDiscount").value) || 0,
        expiryDate: document.getElementById("c-expiry").value
    };

    console.log("Sending data to server:", data); // Check console to see if this triggers e.preventDefault();
    console.log("Saving Coupon..."); // Check if this shows in Console (F12)

    try {
        const data = {
            code: document.getElementById("c-code").value.toUpperCase().trim(),
            type: document.getElementById("c-type").value,
            value: Number(document.getElementById("c-value").value),
            minOrder: Number(document.getElementById("c-minOrder").value) || 0,
            maxdiscount: Number(document.getElementById("c-maxDiscount").value) || 0,
            expiryDate: document.getElementById("c-expiry").value
        };

        console.log("Data to send:", data);

        const res = await fetch(COUPON_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify(data)
        });

        const result = await res.json();

        if (res.ok) {
            alert("Coupon Created!");
            document.getElementById("coupon-form").reset();
            toggleModal('coupon-modal', false);
            fetchCoupons();
        } else {
            alert("Server Error: " + (result.message || "Invalid Data"));
        }
    } catch (err) {
        console.error("Critical Error:", err);
        alert("Check your internet connection or server status.");
    }
}
async function deleteCoupon(id) {
    if (!confirm("Remove this coupon?")) return;
    const res = await fetch(`${COUPON_API}/${id}`, {
        method: "DELETE",
        headers: getAuthHeader()
    });
    if (res.ok) {
        fetchCoupons();
        loadInsights();
    }
}

/* ================= CATEGORY MANAGEMENT ================= */
async function promptNewCategory() {
    const categoryName = prompt("Enter new category name (e.g., Footwear, Accessories):");

    if (!categoryName || categoryName.trim() === "") return;

    try {
        const res = await fetch(CATEGORY_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify({ name: categoryName.trim() })
        });

        if (res.ok) {
            alert(`Category "${categoryName}" added successfully!`);
            // Refresh the dropdowns so the new category appears immediately
            await fetchCategories();
        } else {
            const err = await res.json();
            alert("Failed to add category: " + (err.error || "Unknown error"));
        }
    } catch (err) {
        console.error("Category Create Error:", err);
        alert("System error while creating category.");
    }
}

async function deleteOrder(orderId) {
    if (!confirm("Are you sure you want to delete this order?")) return;

    try {
        const res = await fetch(`${ORDER_API}/${orderId}`, {
            method: "DELETE",
            headers: getAuthHeader()
        });

        const data = await res.json();

        if (res.ok) {
            showToast("Order deleted successfully");
            fetchOrders();
            loadInsights();
        } else {
            showToast(data.message || "Delete failed", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Server error", "error");
    }
}


async function updateOrderStatus(orderId, newStatus) {
    try {
        const res = await fetch(`${ORDER_API}/${orderId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeader()
            },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await res.json();

        if (res.ok) {
            showToast(`Order updated to ${newStatus}`);
            loadInsights();
        } else {
            showToast(data.message || "Update failed", "error");
            fetchOrders();
        }
    } catch (err) {
        console.error(err);
        showToast("Network error", "error");
        fetchOrders();
    }
}
async function fetchReturns() {
    const tbody = document.getElementById("admin-return-list");
    if (!tbody) return;

    try {
        const res = await fetch("http://localhost:5000/api/returns", {
            headers: getAuthHeader()
        });

        const returns = await res.json();

        tbody.innerHTML = returns.map(r => `
            <tr>
                <td>${r.orderId}</td>
                <td>${r.type}</td>
                <td>${r.reason}</td>
                <td>
                    <select onchange="updateReturnStatus('${r._id}', this.value)">
                        <option ${r.status==="Pending"?"selected":""}>Pending</option>
                        <option ${r.status==="Approved"?"selected":""}>Approved</option>
                        <option ${r.status==="Rejected"?"selected":""}>Rejected</option>
                    </select>
                </td>
            </tr>
        `).join("");

    } catch (err) {
        console.error(err);
    }
}

async function updateReturnStatus(id, status) {
    const res = await fetch(`http://localhost:5000/api/returns/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeader()
        },
        body: JSON.stringify({ status })
    });

    if (res.ok) {
        showToast("Return updated");
        fetchReturns();
    }
}