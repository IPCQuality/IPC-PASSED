        document.addEventListener('DOMContentLoaded', () => {
            
            // Service Worker Register & Auto-Update Listener
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('./pwa/sw.js')
                        .then(reg => {
                            console.log('SW terdaftar:', reg.scope);
                            
                            // Cek update Service Worker secara berkala (tiap 5 menit)
                            setInterval(() => {
                                reg.update().catch(() => {});
                            }, 5 * 60 * 1000);

                            // Tangani pembaruan Service Worker jika ada versi baru di server/GitHub
                            reg.addEventListener('updatefound', () => {
                                const newWorker = reg.installing;
                                if (!newWorker) return;
                                newWorker.addEventListener('statechange', () => {
                                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                        showUpdateBanner('Pembaruan sistem & data MID tersedia!', () => {
                                            newWorker.postMessage({ action: 'skipWaiting' });
                                            window.location.reload();
                                        });
                                    }
                                });
                            });
                        })
                        .catch(err => console.error('Gagal mendaftarkan SW:', err));

                    let refreshing = false;
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        if (!refreshing) {
                            refreshing = true;
                            window.location.reload();
                        }
                    });
                });
            }

            // Modal Background Scroll-Lock Manager
            const activeModals = new Set();
            function lockBackgroundScroll(modalKey) {
                activeModals.add(modalKey);
                document.body.classList.add('overflow-hidden');
                document.documentElement.classList.add('overflow-hidden');
            }
            function unlockBackgroundScroll(modalKey) {
                if (modalKey) {
                    activeModals.delete(modalKey);
                } else {
                    activeModals.clear();
                }
                if (activeModals.size === 0) {
                    document.body.classList.remove('overflow-hidden');
                    document.documentElement.classList.remove('overflow-hidden');
                }
            }

            // PWA Install Prompt Handler & Guide Modal
            let deferredPrompt = null;
            const pwaInstallBtn = document.getElementById('pwa-install-btn');
            const pwaGuideModal = document.getElementById('pwa-guide-modal');
            const btnClosePwaModal = document.getElementById('btn-close-pwa-modal');
            const btnDismissPwaModal = document.getElementById('btn-dismiss-pwa-modal');

            function openPwaGuide() {
                if (pwaGuideModal) {
                    lockBackgroundScroll('pwa');
                    pwaGuideModal.classList.remove('opacity-0', 'pointer-events-none');
                    const modalFrame = pwaGuideModal.querySelector('div');
                    if (modalFrame) {
                        modalFrame.classList.remove('scale-95');
                        modalFrame.classList.add('scale-100');
                    }
                }
            }

            function closePwaGuide() {
                if (pwaGuideModal) {
                    unlockBackgroundScroll('pwa');
                    pwaGuideModal.classList.add('opacity-0', 'pointer-events-none');
                    const modalFrame = pwaGuideModal.querySelector('div');
                    if (modalFrame) {
                        modalFrame.classList.remove('scale-100');
                        modalFrame.classList.add('scale-95');
                    }
                }
            }

            if (btnClosePwaModal) btnClosePwaModal.addEventListener('click', closePwaGuide);
            if (btnDismissPwaModal) btnDismissPwaModal.addEventListener('click', closePwaGuide);
            if (pwaGuideModal) {
                pwaGuideModal.addEventListener('click', (e) => {
                    if (e.target === pwaGuideModal) closePwaGuide();
                });
            }

            // Tangani event beforeinstallprompt (Chrome, Edge, Samsung Internet, Android)
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                console.log('PWA beforeinstallprompt terdeteksi');
            });

            if (pwaInstallBtn) {
                // Periksa apakah sudah berjalan dalam mode PWA / Standalone
                const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
                if (isStandalone) {
                    pwaInstallBtn.classList.add('hidden');
                }

                pwaInstallBtn.addEventListener('click', async () => {
                    if (deferredPrompt) {
                        try {
                            deferredPrompt.prompt();
                            const { outcome } = await deferredPrompt.userChoice;
                            if (outcome === 'accepted') {
                                pwaInstallBtn.classList.add('hidden');
                            }
                            deferredPrompt = null;
                        } catch (err) {
                            console.warn('Gagal memicu install prompt native:', err);
                            openPwaGuide();
                        }
                    } else {
                        // Jika native prompt belum tersedia atau di browser seperti Safari/Firefox
                        openPwaGuide();
                    }
                });
            }

            window.addEventListener('appinstalled', () => {
                if (pwaInstallBtn) {
                    pwaInstallBtn.classList.add('hidden');
                }
                closePwaGuide();
                console.log('PWA berhasil di-install');
            });

            const CONFIG = {
                jsonPath: './data/deskripsi.json',
                imageFolder: './images/',
                maxHistory: 10
            };

            let allDataCache = null;
            let currentState = 'placeholder';
            let lastCheckTime = Date.now();
            let isSyncing = false;
            let pendingUpdateData = null;
            
            let historyData = [
                { mid: '1160916', deskripsi: '' },
                { mid: '63212', deskripsi: '' },
                { mid: '63128', deskripsi: '' },
                { mid: '63129', deskripsi: '' },
                { mid: '63240', deskripsi: '' },
                { mid: '61171', deskripsi: '' },
                { mid: '17009404', deskripsi: '' },
                { mid: '1462626', deskripsi: '' },
                { mid: '80888', deskripsi: '' },
                { mid: '61862', deskripsi: '' }
            ];

            try {
                const stored = localStorage.getItem('midHistory_v7');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed) && parsed.length > 0) historyData = parsed;
                }
            } catch (e) {
                console.warn("Gagal membaca riwayat penyimpanan lokal", e);
            }

            const el = {
                leftPanel: document.getElementById('left-panel'),
                rightPanel: document.getElementById('right-panel'),
                
                selectMesin: document.getElementById('select-mesin'),
                selectShift: document.getElementById('select-shift'),

                input: document.getElementById('mid-input'),
                suggestionsBox: document.getElementById('suggestions-box'),
                btnSearch: document.getElementById('btn-search'),
                btnBackMobile: document.getElementById('btn-back-mobile'),
                btnBackError: document.getElementById('btn-back-error'),
                
                historyContainer: document.getElementById('history-container'),
                
                viewLoading: document.getElementById('view-loading'),
                viewResult: document.getElementById('view-result'),
                viewError: document.getElementById('view-error'),
                
                resMid: document.getElementById('res-mid'),
                resContainer: document.getElementById('res-container'),
                errMid: document.getElementById('err-mid'),
                toast: document.getElementById('toast'),

                badgeMesinName: document.getElementById('badge-mesin-name'),
                badgeShiftName: document.getElementById('badge-shift-name'),
                badgeLineWrap: document.getElementById('badge-line-wrap'),
                badgeLineName: document.getElementById('badge-line-name'),
                btnChangeConfig: document.getElementById('btn-change-config'),

                modalSelectConfig: document.getElementById('modal-select-config'),
                modalMidTitle: document.getElementById('modal-mid-title'),
                modalMidDesc: document.getElementById('modal-mid-desc'),
                modalClusterWarning: document.getElementById('modal-cluster-warning'),
                modalClusterWarningText: document.getElementById('modal-cluster-warning-text'),
                btnCloseConfigModal: document.getElementById('btn-close-config-modal'),
                btnCancelConfigModal: document.getElementById('btn-cancel-config-modal'),
                btnConfirmConfigModal: document.getElementById('btn-confirm-config-modal'),

                modal: document.getElementById('image-modal'),
                modalFrame: document.getElementById('modal-frame'),
                modalImg: document.getElementById('modal-img'),
                btnCloseModal: document.getElementById('btn-close-modal'),

                themeToggle: document.getElementById('theme-toggle'),
                lightIcon: document.getElementById('theme-toggle-light-icon'),
                darkIcon: document.getElementById('theme-toggle-dark-icon'),

                btnSyncData: document.getElementById('btn-sync-data'),
                syncIcon: document.getElementById('sync-icon'),
                updateNotification: document.getElementById('update-notification'),
                updateMsg: document.getElementById('update-msg'),
                btnApplyUpdate: document.getElementById('btn-apply-update')
            };

            // Tema Gelap / Terang
            function initTheme() {
                const userTheme = localStorage.getItem('appTheme');
                const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                setDarkMode(userTheme === 'dark' || (!userTheme && systemPrefersDark));
            }

            function setDarkMode(isDark) {
                if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.body.classList.remove('light-theme');
                    document.body.classList.add('dark-theme');
                    el.lightIcon.classList.remove('hidden');
                    el.darkIcon.classList.add('hidden');
                    localStorage.setItem('appTheme', 'dark');
                } else {
                    document.documentElement.classList.remove('dark');
                    document.body.classList.remove('dark-theme');
                    document.body.classList.add('light-theme');
                    el.lightIcon.classList.add('hidden');
                    el.darkIcon.classList.remove('hidden');
                    localStorage.setItem('appTheme', 'light');
                }
            }

            el.themeToggle.addEventListener('click', () => {
                setDarkMode(!document.documentElement.classList.contains('dark'));
            });

            initTheme();
            fetchData();
            showState('placeholder');
            enrichHistoryDescriptions();

            // Update Banner Controller
            let currentUpdateCallback = null;

            function showUpdateBanner(message, onAction) {
                if (!el.updateNotification) return;
                if (el.updateMsg) el.updateMsg.textContent = message;
                currentUpdateCallback = onAction;
                el.updateNotification.classList.remove('hidden');
                el.updateNotification.classList.add('flex');
            }

            function hideUpdateBanner() {
                if (!el.updateNotification) return;
                el.updateNotification.classList.add('hidden');
                el.updateNotification.classList.remove('flex');
                currentUpdateCallback = null;
            }

            if (el.btnApplyUpdate) {
                el.btnApplyUpdate.addEventListener('click', () => {
                    if (typeof currentUpdateCallback === 'function') {
                        currentUpdateCallback();
                    } else {
                        syncDataManual(true);
                    }
                    hideUpdateBanner();
                });
            }

            // Fungsi Sinkronisasi Data Manual
            async function syncDataManual(silent = false) {
                if (isSyncing) return;
                isSyncing = true;

                if (el.syncIcon) el.syncIcon.classList.add('animate-spin');

                try {
                    // Beri tahu Service Worker untuk membuang cache lama deskripsi.json
                    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                        navigator.serviceWorker.controller.postMessage({ action: 'invalidateDataCache' });
                    }

                    const freshData = await fetchData(true);
                    await enrichHistoryDescriptions();

                    if (!silent) {
                        showToast(`Data MID disinkronkan (${freshData.length} item)`);
                    }
                    hideUpdateBanner();
                } catch (e) {
                    console.error("Gagal sinkronisasi data:", e);
                    if (!silent) showToast("Gagal menyinkronkan data terbaru");
                } finally {
                    isSyncing = false;
                    if (el.syncIcon) {
                        setTimeout(() => el.syncIcon.classList.remove('animate-spin'), 500);
                    }
                }
            }

            if (el.btnSyncData) {
                el.btnSyncData.addEventListener('click', () => {
                    syncDataManual(false);
                });
            }

            // Penanganan sinyal update dari Admin (BroadcastChannel & Storage Event)
            async function handleRemoteUpdateNotification(data) {
                console.log("[Sync] Menerima sinyal pembaruan data dari Admin:", data);
                lastCheckTime = Date.now();

                // Bersihkan cache SW
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ action: 'invalidateDataCache' });
                }

                // Jika operator berada di tampilan awal (placeholder): refresh diam-diam
                if (currentState === 'placeholder') {
                    await fetchData(true);
                    await enrichHistoryDescriptions();
                    showToast("Data MID terbaru berhasil disinkronkan!");
                } else {
                    // Jika operator sedang melihat hasil MID: tampilkan notifikasi banner agar tidak hilang
                    showUpdateBanner("Data MID baru telah disimpan di Admin.", async () => {
                        await fetchData(true);
                        await enrichHistoryDescriptions();
                        const currentMid = el.input.value.trim();
                        if (currentMid) {
                            handleSearch(currentMid);
                        } else {
                            showState('placeholder');
                        }
                    });
                }
            }

            // 1. BroadcastChannel antar tab
            try {
                if ('BroadcastChannel' in window) {
                    const syncChannel = new BroadcastChannel('ipc_passed_sync');
                    syncChannel.onmessage = (event) => {
                        if (event.data && event.data.type === 'DATA_UPDATED') {
                            handleRemoteUpdateNotification(event.data);
                        }
                    };
                }
            } catch (err) {
                console.warn("BroadcastChannel tidak didukung:", err);
            }

            // 2. Storage Event (lintas tab/window fallback)
            window.addEventListener('storage', (event) => {
                if (event.key === 'ipc_last_data_update' && event.newValue) {
                    try {
                        const parsed = JSON.parse(event.newValue);
                        handleRemoteUpdateNotification(parsed);
                    } catch (e) {}
                }
            });

            // 3. Deteksi saat browser kembali online
            window.addEventListener('online', () => {
                console.log("[Sync] Jaringan terhubung kembali, menyinkronkan data...");
                syncDataManual(true);
            });

            // 4. Deteksi saat tab kembali dibuka / difokuskan oleh operator
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    const now = Date.now();
                    if (now - lastCheckTime > 60 * 1000) {
                        lastCheckTime = now;
                        checkForBackgroundUpdates();
                    }
                }
            });

            async function checkForBackgroundUpdates() {
                try {
                    const fetchUrl = `${CONFIG.jsonPath}?_chk=${Date.now()}`;
                    const response = await fetch(fetchUrl, {
                        cache: 'no-cache',
                        headers: { 'Cache-Control': 'no-cache, no-store' }
                    });
                    if (!response.ok) return;
                    const freshData = await response.json();
                    const records = Array.isArray(freshData) ? freshData : (freshData.records || freshData.data || []);
                    if (records.length > 0 && allDataCache) {
                        if (records.length !== allDataCache.length || JSON.stringify(records[0]) !== JSON.stringify(allDataCache[0])) {
                            handleRemoteUpdateNotification({ timestamp: Date.now(), source: 'background-check' });
                        }
                    }
                } catch (e) {}
            }

            // Fitur Saran Pengetikan (Autocomplete)
            el.input.addEventListener('input', (e) => {
                const query = e.target.value.trim().toLowerCase();
                showSuggestions(query);
            });

            document.addEventListener('click', (e) => {
                if (!el.input.contains(e.target) && !el.suggestionsBox.contains(e.target)) {
                    el.suggestionsBox.classList.add('hidden');
                }
            });

            function showSuggestions(query) {
                if (!query || !allDataCache) {
                    el.suggestionsBox.classList.add('hidden');
                    return;
                }

                const matches = allDataCache.filter(item => {
                    const midStr = String(item.mid).toLowerCase();
                    const descStr = (item.deskripsi || '').toLowerCase();
                    return midStr.includes(query) || descStr.includes(query);
                }).slice(0, 7);

                if (matches.length === 0) {
                    el.suggestionsBox.classList.add('hidden');
                    return;
                }

                el.suggestionsBox.innerHTML = '';
                
                matches.forEach(item => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/60 flex items-center gap-2.5 transition-colors border-b last:border-b-0 border-gray-100 dark:border-slate-700/50';
                    btn.innerHTML = `
                        <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                        <div class="truncate text-xs sm:text-sm">
                            <span class="font-bold text-blue-600 dark:text-blue-400">${item.mid}</span>
                            <span class="text-gray-500 dark:text-gray-400 ml-1 font-normal truncate">- ${item.deskripsi || ''}</span>
                        </div>
                    `;
                    btn.onclick = () => {
                        el.input.value = item.mid;
                        el.suggestionsBox.classList.add('hidden');
                        handleSearch(item.mid);
                    };
                    el.suggestionsBox.appendChild(btn);
                });

                el.suggestionsBox.classList.remove('hidden');
            }

            el.btnSearch.addEventListener('click', () => handleSearch());
            el.input.addEventListener('keypress', (e) => { 
                if (e.key === 'Enter') {
                    el.suggestionsBox.classList.add('hidden');
                    handleSearch(); 
                }
            });
            if (el.btnBackMobile) el.btnBackMobile.addEventListener('click', resetView);
            if (el.btnBackError) el.btnBackError.addEventListener('click', resetView);

            window.addEventListener('resize', () => showState(currentState));

            el.resContainer.addEventListener('click', (e) => {
                if (e.target.tagName === 'IMG' && e.target.id !== 'modal-img') {
                    openModal(e.target.src);
                }
            });
            el.btnCloseModal.addEventListener('click', closeModal);
            el.modal.addEventListener('click', (e) => {
                if (e.target === el.modal || e.target === el.modalFrame) closeModal();
            });

            function showToast(message) {
                el.toast.textContent = message;
                el.toast.classList.remove('opacity-0', 'pointer-events-none');
                el.toast.classList.add('opacity-100');
                setTimeout(() => {
                    el.toast.classList.remove('opacity-100');
                    el.toast.classList.add('opacity-0', 'pointer-events-none');
                }, 3000);
            }

            function openModal(src) {
                lockBackgroundScroll('image');
                el.modalImg.src = src;
                el.modal.classList.remove('opacity-0', 'pointer-events-none');
                el.modalFrame.classList.remove('scale-95');
                el.modalFrame.classList.add('scale-100');
            }

            function closeModal() {
                unlockBackgroundScroll('image');
                el.modal.classList.add('opacity-0', 'pointer-events-none');
                el.modalFrame.classList.remove('scale-100');
                el.modalFrame.classList.add('scale-95');
                setTimeout(() => { el.modalImg.src = ''; }, 300);
            }

            function resetView() {
                unlockBackgroundScroll();
                el.input.value = '';
                el.suggestionsBox.classList.add('hidden');
                showState('placeholder');
                el.input.focus();
            }

            function toggleView(element, showStatus) {
                if (!element) return;
                if (showStatus) {
                    element.classList.remove('hidden');
                    element.classList.add('flex');
                } else {
                    element.classList.add('hidden');
                    element.classList.remove('flex');
                }
            }

            function showState(stateName) {
                currentState = stateName;
                const isMobile = window.innerWidth < 1024;

                if (stateName === 'placeholder') {
                    if (isMobile) {
                        el.leftPanel.classList.remove('hidden');
                        el.rightPanel.classList.add('hidden');
                    } else {
                        el.leftPanel.classList.remove('hidden');
                        el.rightPanel.classList.remove('hidden');
                    }
                } else {
                    if (isMobile) {
                        el.leftPanel.classList.add('hidden');
                        el.rightPanel.classList.remove('hidden');
                    } else {
                        el.leftPanel.classList.remove('hidden');
                        el.rightPanel.classList.remove('hidden');
                    }
                }
                
                toggleView(el.viewLoading, stateName === 'loading');
                toggleView(el.viewResult, stateName === 'result');
                toggleView(el.viewError, stateName === 'error');

                renderHistory();
            }

            let machinesCache = [];
            let formatsCache = [];
            let currentSearchMid = null;
            let currentSearchMatches = null;

            async function fetchMachines() {
                try {
                    const res = await fetch(`./data/mesin.json?_cb=${Date.now()}`);
                    if (res.ok) {
                        const data = await res.json();
                        machinesCache = data.machines || [];
                        populateMachineDropdown();
                    }
                } catch (e) {
                    console.warn("Gagal memuat mesin.json:", e);
                }
            }

            async function fetchFormats() {
                try {
                    const res = await fetch(`./data/format.json?_cb=${Date.now()}`);
                    if (res.ok) {
                        formatsCache = await res.json();
                    }
                } catch (e) {
                    console.warn("Gagal memuat format.json:", e);
                }
            }

            function getFormatCluster(formatKey, desc = '') {
                const key = (formatKey || '').toLowerCase();
                const d = (desc || '').toUpperCase();
                if (key.includes('pouch') || d.includes('POUCH') || d.includes('REFILL')) {
                    return 'pouch';
                }
                if (key.includes('sachet') || key.includes('sct') || d.includes('SACHET') || d.includes('SCT')) {
                    return 'sachet';
                }
                if (key.includes('botol') || key.includes('btl') || key.includes('jar') || key.includes('can') || d.includes('BTL') || d.includes('BOTTLE') || d.includes('JRC')) {
                    return 'botol';
                }
                return null;
            }

            function populateMachineDropdown(targetCluster = null) {
                if (!el.selectMesin) return;
                
                const clusterLabel = targetCluster ? (targetCluster.charAt(0).toUpperCase() + targetCluster.slice(1)) : '';
                el.selectMesin.innerHTML = `<option value="">-- Pilih Mesin${clusterLabel ? ` (${clusterLabel})` : ''} --</option>`;
                
                const seenNames = new Set();
                const filteredMachines = machinesCache.filter(m => {
                    if (!targetCluster) return true;
                    const mCluster = m.cluster || (
                        (m.name || '').startsWith('AST') ? 'sachet' :
                        (m.name || '').startsWith('APK') ? 'pouch' : 'botol'
                    );
                    return mCluster === targetCluster;
                });

                // Jika filter menghasilkan data mesin, tampilkan mesin terfilter; jika tidak ada, fallback tampilkan semua mesin
                const listToRender = [...(filteredMachines.length > 0 ? filteredMachines : machinesCache)];

                // Urutkan mesin dari yang terkecil ke terbesar (Natural Sort: AST 2, AST 3, ... AST 71, APK 9, APK 12, dst.)
                listToRender.sort((a, b) => {
                    const nameA = String(a.name || a.id || '').trim();
                    const nameB = String(b.name || b.id || '').trim();
                    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
                });

                listToRender.forEach(m => {
                    const machineName = m.name || m.id;
                    if (machineName && !seenNames.has(machineName)) {
                        seenNames.add(machineName);
                        const opt = document.createElement('option');
                        opt.value = machineName;
                        opt.textContent = machineName; // Hanya menampilkan nama mesin saja
                        el.selectMesin.appendChild(opt);
                    }
                });
            }

            // Fungsi Sinkronisasi Shift Otomatis Berdasarkan Waktu & Hari Realtime
            function autoSyncShift() {
                if (!el.selectShift || !window.Formater || typeof window.Formater.getShiftFromTime !== 'function') return;
                const now = new Date();
                const hours = String(now.getHours()).padStart(2, '0');
                const mins = String(now.getMinutes()).padStart(2, '0');
                const detectedShift = window.Formater.getShiftFromTime(now, `${hours}:${mins}`);
                el.selectShift.value = String(detectedShift);
            }

            autoSyncShift();

            fetchMachines();
            fetchFormats();

            let pendingSearchMid = null;
            let pendingSearchMatches = null;

            function updateModalClusterWarning() {
                if (!el.modalClusterWarning || !el.modalClusterWarningText) return;
                const primaryItem = pendingSearchMatches && pendingSearchMatches[0] ? pendingSearchMatches[0] : {};
                const formatKey = primaryItem.format || (
                    (primaryItem.deskripsi && (primaryItem.deskripsi.includes('BTL') || primaryItem.deskripsi.includes('BOTTLE') || primaryItem.deskripsi.includes('JRC'))) ? 'botol1' :
                    (primaryItem.deskripsi && primaryItem.deskripsi.includes('SO SOFT')) ? 'sosoft1' : 'lpouch1'
                );
                const prodCluster = getFormatCluster(formatKey, primaryItem.deskripsi);
                const chosenMachineName = (el.selectMesin?.value || '').trim();

                if (!chosenMachineName || !prodCluster) {
                    el.modalClusterWarning.classList.add('hidden');
                    return;
                }

                const machineObj = machinesCache.find(m => (m.name || m.id) === chosenMachineName);
                const machCluster = machineObj?.cluster || (
                    chosenMachineName.startsWith('AST') ? 'sachet' :
                    chosenMachineName.startsWith('APK') ? 'pouch' : 'botol'
                );

                if (machCluster && prodCluster && machCluster !== prodCluster) {
                    el.modalClusterWarningText.textContent = `Peringatan: Tipe kemasan produk ini (${prodCluster.toUpperCase()}) tidak sesuai dengan cluster mesin ${chosenMachineName} (${machCluster.toUpperCase()}).`;
                    el.modalClusterWarning.classList.remove('hidden');
                } else {
                    el.modalClusterWarning.classList.add('hidden');
                }
            }

            function openConfigModal(mid, matches) {
                pendingSearchMid = mid;
                pendingSearchMatches = matches;

                if (el.modalMidTitle) el.modalMidTitle.textContent = `MID: ${mid}`;
                if (el.modalMidDesc) el.modalMidDesc.textContent = (matches && matches[0] && matches[0].deskripsi) ? matches[0].deskripsi : 'Pemeriksaan MID Produk';

                // Tentukan cluster format dari MID produk
                const primaryItem = matches && matches[0] ? matches[0] : {};
                const formatKey = primaryItem.format || (
                    (primaryItem.deskripsi && (primaryItem.deskripsi.includes('BTL') || primaryItem.deskripsi.includes('BOTTLE') || primaryItem.deskripsi.includes('JRC'))) ? 'botol1' :
                    (primaryItem.deskripsi && primaryItem.deskripsi.includes('SO SOFT')) ? 'sosoft1' : 'lpouch1'
                );
                const targetCluster = getFormatCluster(formatKey, primaryItem.deskripsi);
                
                // Isi dropdown mesin berdasarkan cluster kemasan
                populateMachineDropdown(targetCluster);

                // Periksa kecocokan cluster
                updateModalClusterWarning();

                // Sinkronkan shift otomatis bila belum dipilih manual
                autoSyncShift();

                if (el.modalSelectConfig) {
                    lockBackgroundScroll('config');
                    el.modalSelectConfig.classList.remove('hidden');
                }
            }

            function closeConfigModal() {
                if (el.modalSelectConfig) {
                    unlockBackgroundScroll('config');
                    el.modalSelectConfig.classList.add('hidden');
                }
            }

            function dismissConfigModal() {
                closeConfigModal();
                if (currentState === 'result') {
                    // Jika pop-up dibuka dari halaman Hasil (misal tombol Ubah), kembali ke halaman Hasil tanpa reset
                    return;
                }
                // Jika pop-up dibuka dari pencarian MID baru, kembali ke pencarian MID
                resetView();
            }

            if (el.btnConfirmConfigModal) {
                el.btnConfirmConfigModal.addEventListener('click', () => {
                    if (!pendingSearchMid || !pendingSearchMatches) return;
                    const midToRender = pendingSearchMid;
                    const matchesToRender = pendingSearchMatches;
                    closeConfigModal();
                    renderResult(midToRender, matchesToRender);
                    saveHistory(midToRender, matchesToRender[0]?.deskripsi);
                    showState('result');
                });
            }

            if (el.btnCancelConfigModal) {
                el.btnCancelConfigModal.addEventListener('click', () => {
                    dismissConfigModal();
                });
            }

            if (el.btnCloseConfigModal) {
                el.btnCloseConfigModal.addEventListener('click', () => {
                    dismissConfigModal();
                });
            }

            if (el.modalSelectConfig) {
                el.modalSelectConfig.addEventListener('click', (e) => {
                    if (e.target === el.modalSelectConfig) {
                        dismissConfigModal();
                    }
                });
            }

            // Keyboard Escape listener untuk menutup pop up
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    if (el.modalSelectConfig && !el.modalSelectConfig.classList.contains('hidden')) {
                        dismissConfigModal();
                    } else if (el.modal && !el.modal.classList.contains('opacity-0')) {
                        closeModal();
                    } else if (pwaGuideModal && !pwaGuideModal.classList.contains('opacity-0')) {
                        closePwaGuide();
                    }
                }
            });

            if (el.btnChangeConfig) {
                el.btnChangeConfig.addEventListener('click', () => {
                    if (currentSearchMid && currentSearchMatches) {
                        openConfigModal(currentSearchMid, currentSearchMatches);
                    }
                });
            }

            // Event Listeners untuk sinkronisasi dan render ulang saat ada perubahan mesin atau shift di modal / setting
            [el.selectMesin, el.selectShift].forEach(elem => {
                if (elem) {
                    elem.addEventListener('change', () => {
                        updateModalClusterWarning();
                        if (currentSearchMid && currentSearchMatches && currentState === 'result') {
                            renderResult(currentSearchMid, currentSearchMatches);
                        }
                    });
                }
            });

            // Pembaruan Realtime Otomatis: Cek setiap menit untuk update jam sekunder dan auto-sync shift
            setInterval(() => {
                if (currentSearchMid && currentSearchMatches && currentState === 'result') {
                    renderResult(currentSearchMid, currentSearchMatches);
                }
            }, 30000); // interval 30 detik untuk akurasi pergantian menit jam yang presisi

            async function fetchData(forceRefresh = false) {
                if (allDataCache && !forceRefresh) return allDataCache;
                if (window.location.protocol === 'blob:') return getFallbackData();

                try {
                    // Cache busting dengan timestamp unik dan header anti-cache untuk selalu mengambil data terkini dari server/GitHub
                    const fetchUrl = `${CONFIG.jsonPath}?_cb=${Date.now()}`;
                    const response = await fetch(fetchUrl, {
                        cache: 'no-cache',
                        headers: {
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache'
                        }
                    });
                    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
                    
                    const data = await response.json();
                    let records = Array.isArray(data) ? data : (data.records || data.data || []);

                    if (records.length > 0) {
                        allDataCache = records;
                        lastCheckTime = Date.now();
                        return allDataCache;
                    } else {
                        throw new Error("Format berkas JSON kosong");
                    }
                } catch (error) {
                    console.warn("Fetch data terkini gagal / offline, menggunakan cache lokal:", error);
                    if (allDataCache) return allDataCache;
                    allDataCache = getFallbackData();
                    return allDataCache;
                }
            }

            async function enrichHistoryDescriptions() {
                try {
                    const records = await fetchData();
                    let updated = false;
                    
                    historyData = historyData.map(item => {
                        const midStr = typeof item === 'object' ? String(item.mid) : String(item);
                        const match = records.find(r => String(r.mid) === midStr);
                        if (match && match.deskripsi) {
                            updated = true;
                            return { mid: midStr, deskripsi: match.deskripsi };
                        }
                        return typeof item === 'object' ? item : { mid: midStr, deskripsi: '' };
                    });

                    if (updated) {
                        try {
                            localStorage.setItem('midHistory_v7', JSON.stringify(historyData));
                        } catch (e) {}
                        renderHistory();
                    }
                } catch (e) {
                    console.warn("Gagal memperbarui deskripsi riwayat:", e);
                }
            }

            async function handleSearch(overrideMid = null) {
                const mid = overrideMid || el.input.value.trim();
                el.suggestionsBox.classList.add('hidden');
                
                if (!mid) {
                    showToast('Silakan masukkan kode MID terlebih dahulu');
                    el.input.focus();
                    return;
                }

                el.input.blur();
                showState('loading');

                try {
                    const records = await fetchData();
                    await new Promise(r => setTimeout(r, 150));

                    const matches = records.filter(record => String(record.mid) === String(mid));

                    if (matches.length > 0) {
                        // Munculkan pop up pilih mesin dan shift terlebih dahulu
                        openConfigModal(mid, matches);
                    } else {
                        el.errMid.textContent = mid;
                        showState('error');
                    }
                } catch (error) {
                    el.errMid.textContent = mid;
                    showState('error');
                }
            }

            function renderResult(mid, matches) {
                currentSearchMid = mid;
                currentSearchMatches = matches;

                el.resMid.textContent = mid;
                el.resContainer.innerHTML = ''; 
                
                const fallbackImg = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjY2JkNWUxIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiPjwvcmVjdD48Y2lyY2xlIGN4PSI4LjUiIGN5PSI4LjUiIHI9IjEuNSI+PC9jaXJjbGU+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSI+PC9wb2x5bGluZT48L3N2Zz4=";

                const selectedMachineId = el.selectMesin ? el.selectMesin.value : '';
                const selectedMachine = machinesCache.find(m => (m.name && m.name === selectedMachineId) || (m.id && m.id === selectedMachineId)) || null;
                const selectedShift = el.selectShift ? (parseInt(el.selectShift.value) || 1) : 1;
                
                // Update badge status di sticky quick bar hasil
                if (el.badgeMesinName) {
                    el.badgeMesinName.textContent = selectedMachine ? selectedMachine.name : 'Semua Mesin';
                }
                if (el.badgeShiftName) {
                    el.badgeShiftName.textContent = `Shift ${selectedShift}`;
                }
                if (el.badgeLineWrap && el.badgeLineName) {
                    if (selectedMachine && selectedMachine.line) {
                        el.badgeLineName.textContent = selectedMachine.line;
                        el.badgeLineWrap.classList.remove('hidden');
                    } else {
                        el.badgeLineWrap.classList.add('hidden');
                    }
                }

                // Mengikuti waktu realtime saat ini
                const nowRealtime = new Date();
                const realtimeJam = `${String(nowRealtime.getHours()).padStart(2, '0')}:${String(nowRealtime.getMinutes()).padStart(2, '0')}`;

                matches.forEach((item) => {
                    const cleanedImgName = item.img ? String(item.img).trim() : '';
                    const imgSrc = (cleanedImgName && cleanedImgName !== '-') ? `${CONFIG.imageFolder}${cleanedImgName}` : fallbackImg;
                    const hasTdk = item.tdk && String(item.tdk).trim() !== '' && String(item.tdk).trim() !== '-';
                    
                    const tdkHtml = hasTdk ? `
                        <div class="bg-gray-50 dark:bg-slate-800/60 p-3 rounded-xl border border-gray-100 dark:border-slate-800 text-left">
                            <span class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5 block">No. TDK</span>
                            <span class="text-gray-700 dark:text-gray-300 font-semibold text-xs sm:text-sm">${item.tdk}</span>
                        </div>
                    ` : '';

                    // Evaluasi format kode printing
                    const formatKey = item.format || (
                        (item.deskripsi && (item.deskripsi.includes('BTL') || item.deskripsi.includes('BOTTLE') || item.deskripsi.includes('JRC'))) ? 'botol1' :
                        (item.deskripsi && item.deskripsi.includes('SO SOFT')) ? 'sosoft1' : 'lpouch1'
                    );

                    let formatDef = null;
                    if (Array.isArray(formatsCache)) {
                        formatDef = formatsCache.find(f => f.format === formatKey);
                    } else if (formatsCache && typeof formatsCache === 'object') {
                        formatDef = formatsCache[formatKey] || null;
                    }

                    let primerText = '-';
                    let sekunderText = '-';

                    if (window.Formater && formatDef) {
                        const opt = {
                            date: nowRealtime,
                            shift: selectedShift,
                            machine: selectedMachine,
                            customTime: realtimeJam,
                            numLot: '1' // Lot default 1 -> Huruf Lot 'A' (2=B, 3=C, dst)
                        };
                        if (formatDef.primer) primerText = window.Formater.formatCode(formatDef.primer, { ...opt, isSekunder: false });
                        if (formatDef.sekunder) sekunderText = window.Formater.formatCode(formatDef.sekunder, { ...opt, isSekunder: true });
                    }

                    const cleanPrimer = primerText ? String(primerText).split('\n').map(l => l.trim()).join('\n').trim() : '-';
                    const cleanSekunder = sekunderText ? String(sekunderText).split('\n').map(l => l.trim()).join('\n').trim() : '-';

                    // Validasi kecocokan cluster mesin vs produk
                    const prodCluster = getFormatCluster(formatKey, item.deskripsi);
                    const machCluster = selectedMachine ? (selectedMachine.cluster || (
                        selectedMachine.name.startsWith('AST') ? 'sachet' :
                        selectedMachine.name.startsWith('APK') ? 'pouch' : 'botol'
                    )) : null;
                    const isClusterMismatch = !!(selectedMachine && prodCluster && machCluster && prodCluster !== machCluster);

                    const mismatchWarningHtml = isClusterMismatch ? `
                        <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-2.5 flex items-start gap-2 text-left">
                            <span class="text-amber-500 text-sm leading-none mt-0.5">⚠️</span>
                            <div class="text-[11px] font-semibold text-amber-800 dark:text-amber-300 leading-snug">
                                Peringatan: Tipe kemasan produk (${prodCluster.toUpperCase()}) tidak sesuai dengan cluster mesin ${selectedMachine.name} (${machCluster.toUpperCase()}).
                            </div>
                        </div>
                    ` : '';

                    const formatHtml = `
                        <div class="bg-blue-50/60 dark:bg-blue-950/30 p-3.5 rounded-xl border border-blue-100/50 dark:border-blue-900/40 space-y-2.5 text-left">
                            <div class="flex items-center justify-between">
                                <span class="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest block text-left">Spesifikasi Format Printing (${formatKey})</span>
                                ${selectedMachine ? `<span class="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-md font-mono">${selectedMachine.name}</span>` : '<span class="text-[10px] bg-blue-100/70 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded-md">Default</span>'}
                            </div>

                            ${mismatchWarningHtml}

                            <div class="space-y-2 text-left">
                                <div class="text-left flex flex-col justify-start items-start">
                                    <span class="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest block mb-1 text-left">Format Primer (Emboss / Inkjet Kemasan)</span>
                                    <div class="w-full bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-blue-200/60 dark:border-blue-800/60 font-mono text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words text-left tracking-wide shadow-sm select-text">${cleanPrimer}</div>
                                </div>

                                <div class="text-left flex flex-col justify-start items-start">
                                    <span class="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest block mb-1 text-left">Format Sekunder (Inkjet Outer / Kardus)</span>
                                    <div class="w-full bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-blue-200/60 dark:border-blue-800/60 font-mono text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words text-left tracking-wide shadow-sm select-text">${cleanSekunder}</div>
                                </div>
                            </div>
                        </div>
                    `;

                    const cardHtml = `
                        <div class="bg-white dark:bg-slate-800/90 border border-gray-100 dark:border-slate-700/60 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-start">
                            <div class="w-full min-h-[180px] max-h-[250px] bg-gray-50 dark:bg-slate-900/60 relative border-b border-gray-100 dark:border-slate-800 flex items-center justify-center p-3">
                                <div class="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-white/30 dark:bg-slate-900/50 backdrop-blur-[2px] z-20 pointer-events-none rounded-t-2xl">
                                    <span class="bg-black/75 dark:bg-white/80 text-white dark:text-gray-900 text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg">🔍 Perbesar Gambar</span>
                                </div>
                                <img src="${imgSrc}" alt="${item.deskripsi || 'Gambar'}" 
                                     class="max-w-full max-h-[220px] object-contain z-10 relative rounded-lg cursor-pointer hover:scale-[1.02] transition-transform duration-300"
                                     onerror="this.onerror=null; this.src='${fallbackImg}';">
                            </div>
                            
                            <div class="p-3.5 sm:p-4 flex flex-col justify-start space-y-2.5 text-left">
                                <div class="bg-blue-50/60 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-100/50 dark:border-blue-900/40 text-left">
                                    <span class="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-0.5 block">Deskripsi / Nama Produk</span>
                                    <span class="text-gray-800 dark:text-gray-100 font-bold text-sm sm:text-base">${item.deskripsi || '-'}</span>
                                </div>
                                
                                ${tdkHtml}

                                <div class="bg-blue-50/60 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-100/50 dark:border-blue-900/40 text-left">
                                    <span class="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-0.5 block">Notasi / Keterangan Susunan</span>
                                    <span class="text-gray-800 dark:text-gray-100 font-bold text-sm sm:text-base leading-relaxed">${item.notasi || '-'}</span>
                                </div>

                                ${formatHtml}
                            </div>
                        </div>
                    `;
                    el.resContainer.insertAdjacentHTML('beforeend', cardHtml);
                });
            }

            function saveHistory(mid, deskripsi) {
                if(!mid) return;
                if(!Array.isArray(historyData)) historyData = [];

                historyData = historyData.filter(item => (typeof item === 'object' ? item.mid : item) !== mid);
                historyData.unshift({ mid: mid, deskripsi: deskripsi || '' });
                if (historyData.length > CONFIG.maxHistory) historyData.pop();
                
                try {
                    localStorage.setItem('midHistory_v7', JSON.stringify(historyData));
                } catch (e) { console.warn("Penyimpanan lokal dibatasi"); }
            }

            function renderHistory() {
                if (!el.historyContainer) return;
                el.historyContainer.innerHTML = '';

                if (!Array.isArray(historyData) || historyData.length === 0) {
                    el.historyContainer.innerHTML = '<span class="text-xs text-gray-400 dark:text-gray-500">Belum ada riwayat tersimpan</span>';
                    return;
                }

                el.historyContainer.className = 'flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1 hide-scrollbar w-full';
                
                historyData.forEach(item => {
                    const mid = typeof item === 'object' ? item.mid : item;
                    const desc = typeof item === 'object' ? item.deskripsi : '';
                    
                    const btn = document.createElement('button');
                    btn.className = 'w-full text-left bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-medium px-3 py-2 rounded-xl text-xs transition-all shadow-sm border border-gray-200/70 dark:border-slate-700/80 hover:border-blue-300 dark:hover:border-blue-600 flex justify-between items-center';
                    
                    const labelText = (desc && desc !== '-') ? `${mid} - ${desc}` : mid;
                    btn.innerHTML = `<span class="truncate font-semibold">${labelText}</span><svg class="w-3.5 h-3.5 text-gray-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`;
                    
                    btn.onclick = () => {
                        el.input.value = mid;
                        handleSearch(mid);
                    };
                    el.historyContainer.appendChild(btn);
                });
            }

            function getFallbackData() {
                return [
                    { "mid": "80888", "deskripsi": "SKL Sachet 22 g 12+1", "notasi": "22 Dus x 5 Tier = 110 Dus Maximum Stacking 2 Palet Shelf life 2 tahun", "tdk": "TDK/R&D/PAC/12/0", "img": "TDK_R_D_PAC_12_0.png" },
                    { "mid": "62626", "deskripsi": "Sosoft Twinpack Sachet 80 ml 3+1", "notasi": "9 kardus x 5 tier = 45 dus Maximum Stacking 2 pallet Shelf life 2 tahun 1/2", "tdk": "TDK/R&D/PAC/12/0", "img": "TDK_R_D_PAC_12_0_7.png" },
                    { "mid": "61862", "deskripsi": "SKL Sachet 22 g 12+1", "notasi": "22 Dus x 5 Tier = 110 Dus Maximum Stacking 2 Palet Shelf life 2 tahun", "tdk": "", "img": "TDK_R_D_PAC_12_0.png" },
                    { "mid": "61171", "deskripsi": "EDW 675 gr", "notasi": "10 Box x 5 tier = 50 Box Maximum Stacking 2 Palet Shelf life 2 Tahun", "tdk": "TDK/R&D/PAC/07/052", "img": "TDK_R_D_PAC_07_052.png" }
                ];
            }

        });