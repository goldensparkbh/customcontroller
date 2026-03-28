import React, { useState, useEffect } from 'react';
import { db, storage } from '../../firebase';
import { collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import InventoryPricingEditor from './InventoryPricingEditor';
import LoadingState from '../../components/LoadingState.jsx';
import {
    buildInventoryPayload,
    formatInventoryMoney,
    hydrateInventoryFormEntries
} from './inventoryPricing';
import {
    allocateSequentialNumber,
    getBarcodeValue,
    getInventoryItemNumber,
    normalizeNumericString,
    padNumericString
} from './recordNumbers';

const normalizeOptionRecord = (id, raw = {}) => ({
    id,
    ...raw,
    itemNumber: getInventoryItemNumber({ id, ...raw }),
    barcode: getBarcodeValue({ id, ...raw }),
    ...buildInventoryPayload(raw.inventoryDetails, {
        purchasePrice: raw.purchasePrice ?? 0,
        sellPrice: raw.sellPrice ?? raw.price ?? 0
    }, {
        quantity: raw.quantity ?? 0
    })
});

const fieldStyle = {
    width: '100%',
    padding: '0.7rem 0.8rem',
    borderRadius: '8px',
    border: '1px solid #30363d',
    background: '#0d1117',
    color: '#e6edf3'
};

const AdminParts = () => {
    const [parts, setParts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPart, setSelectedPart] = useState(null);
    const [subitems, setSubitems] = useState([]);
    const [viewMode, setViewMode] = useState('grid');
    const [basePrice, setBasePrice] = useState('0');
    const [isSavingBasePrice, setIsSavingBasePrice] = useState(false);

    // Modal States
    const [showPartFormModal, setShowPartFormModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showOptionFormModal, setShowOptionFormModal] = useState(false);

    // Part Form State
    const [partId, setPartId] = useState('');
    const [partTitle, setPartTitle] = useState('');
    const [partPriority, setPartPriority] = useState(1);
    const [partSide, setPartSide] = useState('front');
    const [partIconFile, setPartIconFile] = useState(null);
    const [partIconPreview, setPartIconPreview] = useState('');

    // Subitem Form State
    const [editSubId, setEditSubId] = useState(null);
    const [subName, setSubName] = useState('');
    const [subItemNumber, setSubItemNumber] = useState('');
    const [subBarcode, setSubBarcode] = useState('');
    const [subPurchasePrice, setSubPurchasePrice] = useState('0');
    const [subSellPrice, setSubSellPrice] = useState('0');
    const [subInventoryDetails, setSubInventoryDetails] = useState([]);
    const [subType, setSubType] = useState('color');
    const [subColorHex, setSubColorHex] = useState('#ffffff');
    const [subDisablesColors, setSubDisablesColors] = useState(false);
    const [subIncompatibleWith, setSubIncompatibleWith] = useState([]); // Array of IDs
    const [subPriority, setSubPriority] = useState(1);
    const [subImageFile, setSubImageFile] = useState(null);
    const [subImagePreview, setSubImagePreview] = useState('');
    const [subSecondImageFile, setSubSecondImageFile] = useState(null);
    const [subSecondImagePreview, setSubSecondImagePreview] = useState('');
    const [subIconFile, setSubIconFile] = useState(null);
    const [subIconPreview, setSubIconPreview] = useState('');
    const [subActive, setSubActive] = useState(true);
    const [subAllowsMultiple, setSubAllowsMultiple] = useState(false);
    const [subExclusiveGroup, setSubExclusiveGroup] = useState('');

    const fetchParts = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'configurator_parts'));
            const partsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            partsList.sort((a, b) => (a.priority || 0) - (b.priority || 0));
            setParts(partsList);

            // Fetch Base Price
            const basePriceDoc = await getDoc(doc(db, 'configurator_settings', 'general'));
            if (basePriceDoc.exists()) {
                setBasePrice(String(basePriceDoc.data().basePrice || 0));
            }
        } catch (e) {
            console.error("Error fetching parts: ", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchParts();
    }, []);

    const handleSaveBasePrice = async () => {
        setIsSavingBasePrice(true);
        try {
            await setDoc(doc(db, 'configurator_settings', 'general'), { basePrice: Number(basePrice) }, { merge: true });
            alert("Base price saved successfully!");
        } catch (error) {
            console.error("Error saving base price:", error);
            alert("Failed to save base price.");
        }
        setIsSavingBasePrice(false);
    };

    // --- PART LOGIC ---

    const handleOpenAddPart = () => {
        setPartId('');
        setPartTitle('');
        setPartPriority(1);
        setPartSide('front');
        setPartIconPreview('');
        setPartIconFile(null);
        setSelectedPart(null); // Clear selected part so ID logic knows it's a new part
        setShowPartFormModal(true);
    };

    const handleEditPart = (p, e) => {
        e.stopPropagation();
        setSelectedPart(p); // Set selected part to know we are editing
        setPartId(p.id);
        setPartTitle(p.title || '');
        setPartPriority(p.priority || 1);
        setPartSide(p.side || 'front');
        setPartIconPreview(p.icon || '');
        setPartIconFile(null);
        setShowPartFormModal(true);
    };

    const handlePartSubmit = async (e) => {
        e.preventDefault();
        try {
            if (!partId || !partTitle) return alert("Missing ID or Title");

            let iconUrl = partIconPreview;
            if (partIconFile) {
                const storageRef = ref(storage, `configurator/icons/${partId}_${Date.now()}`);
                await uploadBytes(storageRef, partIconFile);
                iconUrl = await getDownloadURL(storageRef);
            }

            const docRef = doc(db, 'configurator_parts', partId);
            const partData = {
                title: partTitle,
                priority: parseInt(partPriority),
                side: partSide,
                updatedAt: new Date()
            };
            if (iconUrl) partData.icon = iconUrl;

            await setDoc(docRef, partData, { merge: true });

            if (selectedPart && selectedPart.id === partId) {
                // If we edited the part that is currently 'detailed', update its state
                setSelectedPart({ ...selectedPart, ...partData, id: partId });
            }

            setShowPartFormModal(false);
            fetchParts();
        } catch (error) {
            console.error(error);
            alert("Error saving part");
        }
    };

    const handleDeletePart = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm("Delete this part and all its options?")) return;
        try {
            const subSnap = await getDocs(collection(db, `configurator_parts/${id}/options`));
            const deletions = subSnap.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deletions);

            await deleteDoc(doc(db, 'configurator_parts', id));
            if (selectedPart && selectedPart.id === id) {
                setSelectedPart(null);
                setSubitems([]);
                setShowDetailsModal(false);
            }
            fetchParts();
        } catch (error) {
            console.error(error);
            alert("Error deleting part");
        }
    };

    // --- OPTIONS LOGIC ---

    const fetchSubitems = async (pid) => {
        try {
            const querySnapshot = await getDocs(collection(db, `configurator_parts/${pid}/options`));
            const subList = querySnapshot.docs.map(doc => normalizeOptionRecord(doc.id, doc.data()));
            setSubitems(subList);
        } catch (e) {
            console.error("Error fetching subitems", e);
        }
    };

    const handleOpenPartDetails = (p) => {
        setSelectedPart(p);
        fetchSubitems(p.id);
        setShowDetailsModal(true);
    };

    const handleOpenAddOption = () => {
        setEditSubId(null);
        setSubName('');
        setSubItemNumber('');
        setSubBarcode('');
        setSubPurchasePrice('0');
        setSubSellPrice('0');
        setSubInventoryDetails([]);
        setSubType('color');
        setSubColorHex('#ffffff');
        setSubImagePreview('');
        setSubSecondImagePreview('');
        setSubIconPreview('');
        setSubImageFile(null);
        setSubSecondImageFile(null);
        setSubIconFile(null);
        setSubIncompatibleWith([]);
        setSubFilterQuery('');
        setSubFilterActive('all');
        setSubFilterType('all');
        setSubPriority(1);
        setSubActive(true);
        setSubAllowsMultiple(false);
        setSubExclusiveGroup('');
        setShowOptionFormModal(true);
    };

    const handleEditSubitem = (sub) => {
        setEditSubId(sub.id);
        setSubName(sub.name || '');
        setSubItemNumber(getInventoryItemNumber(sub));
        setSubBarcode(getBarcodeValue(sub));
        setSubPurchasePrice(String(sub.purchasePrice ?? 0));
        setSubSellPrice(String(sub.sellPrice ?? sub.price ?? 0));
        setSubInventoryDetails(hydrateInventoryFormEntries(sub));
        setSubType(sub.type || 'color');
        setSubColorHex(sub.hex || '#ffffff');
        setSubImagePreview(sub.image || '');
        setSubSecondImagePreview(sub.secondImage || '');
        setSubIconPreview(sub.icon || '');
        setSubImageFile(null);
        setSubSecondImageFile(null);
        setSubIconFile(null);
        setSubActive(sub.active !== false); // default to true if undefined
        setSubAllowsMultiple(!!sub.allowsMultiple);
        setSubExclusiveGroup(sub.exclusiveGroup || '');
        setSubDisablesColors(!!sub.disablesColors);
        setSubIncompatibleWith(Array.isArray(sub.incompatibleWith) ? sub.incompatibleWith : []);
        setSubPriority(sub.priority || 1);
        setShowOptionFormModal(true);
    };

    const handleSubitemSubmit = async (e) => {
        e.preventDefault();
        if (!selectedPart) return;
        try {
            let imageUrl = subImagePreview;
            if (subImageFile) {
                const storageRef = ref(storage, `configurator/overlays/${selectedPart.id}/${Date.now()}_${subImageFile.name}`);
                await uploadBytes(storageRef, subImageFile);
                imageUrl = await getDownloadURL(storageRef);
            }

            let secondImageUrl = subSecondImagePreview;
            if (subSecondImageFile) {
                const storageRef2 = ref(storage, `configurator/overlays/second_${selectedPart.id}/${Date.now()}_${subSecondImageFile.name}`);
                await uploadBytes(storageRef2, subSecondImageFile);
                secondImageUrl = await getDownloadURL(storageRef2);
            }

            let iconUrl = subIconPreview;
            if (subIconFile) {
                const iconRef = ref(storage, `configurator/icons/sub/${selectedPart.id}_${Date.now()}_${subIconFile.name}`);
                await uploadBytes(iconRef, subIconFile);
                iconUrl = await getDownloadURL(iconRef);
            }

            const inventoryPayload = buildInventoryPayload(
                subInventoryDetails,
                {
                    purchasePrice: subPurchasePrice,
                    sellPrice: subSellPrice
                },
                {
                    quantity: 0
                }
            );
            const itemNumber = normalizeNumericString(subItemNumber) || await allocateSequentialNumber(db, 'inventory_master');
            const barcode = normalizeNumericString(subBarcode) || itemNumber;

            const data = {
                name: subName,
                itemNumber,
                barcode,
                inventoryDetails: inventoryPayload.inventoryDetails,
                purchasePrice: inventoryPayload.purchasePrice,
                sellPrice: inventoryPayload.sellPrice,
                price: inventoryPayload.price,
                quantity: inventoryPayload.quantity,
                type: subType,
                active: subActive,
                image: imageUrl,
                secondImage: secondImageUrl,
                updatedAt: new Date(),
                disablesColors: subDisablesColors,
                allowsMultiple: subAllowsMultiple,
                exclusiveGroup: subExclusiveGroup,
                incompatibleWith: subIncompatibleWith,
                priority: Number(subPriority || 1)
            };

            if (subType === 'color') {
                data.hex = subColorHex;
                data.icon = null;
            } else {
                data.hex = null;
                data.icon = iconUrl;
            }

            if (editSubId) {
                await updateDoc(doc(db, `configurator_parts/${selectedPart.id}/options`, editSubId), data);
            } else {
                data.createdAt = new Date();
                await addDoc(collection(db, `configurator_parts/${selectedPart.id}/options`), data);
            }

            setShowOptionFormModal(false);
            fetchSubitems(selectedPart.id);
        } catch (error) {
            console.error(error);
            alert("Error saving option");
        }
    };

    const handleDeleteSubitem = async (subId) => {
        if (!window.confirm("Delete this option?")) return;
        try {
            await deleteDoc(doc(db, `configurator_parts/${selectedPart.id}/options`, subId));
            fetchSubitems(selectedPart.id);
        } catch (error) {
            console.error(error);
            alert("Error deleting option");
        }
    };

    if (loading) return <LoadingState message="Loading configurator parts..." minHeight="32vh" />;

    // Common Modal Overlay Style
    const overlayStyle = {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
    };

    const modalStyle = {
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '12px',
        padding: '2rem',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        position: 'relative'
    };

    const closeBtnStyle = {
        position: 'absolute',
        top: '1rem',
        right: '1.5rem',
        background: 'transparent',
        border: 'none',
        color: '#8b949e',
        fontSize: '1.5rem',
        cursor: 'pointer'
    };

    return (
        <div>
            {/* BASE PRICE SETTINGS */}
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', padding: '1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '250px' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#fff' }}>Base Controller Price</h3>
                    <p style={{ margin: 0, color: '#8b949e', fontSize: '0.9rem' }}>This is the initial price of the controller before any customizations are applied.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>BHD</span>
                    <input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        value={basePrice} 
                        onChange={e => setBasePrice(e.target.value)} 
                        style={{ ...fieldStyle, width: '120px', fontSize: '1.1rem' }} 
                    />
                    <button 
                        onClick={handleSaveBasePrice} 
                        disabled={isSavingBasePrice}
                        style={{ padding: '0.7rem 1.2rem', background: '#238636', border: '1px solid rgba(240,246,252,0.1)', color: '#fff', borderRadius: '6px', cursor: isSavingBasePrice ? 'wait' : 'pointer', fontWeight: 600 }}
                    >
                        {isSavingBasePrice ? 'Saving...' : 'Save Price'}
                    </button>
                </div>
            </div>

            {/* MAIN VIEW */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, color: '#fff' }}>Configurator Parts</h3>
                    <div style={{ display: 'inline-flex', background: '#0d1117', border: '1px solid #30363d', borderRadius: '999px', padding: '4px' }}>
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            style={{
                                padding: '0.45rem 0.85rem',
                                borderRadius: '999px',
                                border: 'none',
                                background: viewMode === 'list' ? '#1f6feb' : 'transparent',
                                color: '#fff',
                                cursor: 'pointer'
                            }}
                        >
                            List
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            style={{
                                padding: '0.45rem 0.85rem',
                                borderRadius: '999px',
                                border: 'none',
                                background: viewMode === 'grid' ? '#1f6feb' : 'transparent',
                                color: '#fff',
                                cursor: 'pointer'
                            }}
                        >
                            Grid
                        </button>
                    </div>
                </div>
                <button
                    onClick={handleOpenAddPart}
                    style={{ padding: '0.6rem 1.2rem', background: '#238636', border: '1px solid rgba(240,246,252,0.1)', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                    + Add New Part
                </button>
            </div>

            {viewMode === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
                    {parts.map(p => (
                        <div
                            key={p.id}
                            onClick={() => handleOpenPartDetails(p)}
                            style={{
                                background: '#21262d',
                                border: '1px solid #30363d',
                                borderRadius: '8px',
                                padding: '1.5rem',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                transition: 'transform 0.2s, border-color 0.2s'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#8b949e'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                            onMouseOut={(e) => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.transform = 'translateY(0)' }}
                        >
                            {p.icon ? (
                                <img src={p.icon} alt="" style={{ height: '60px', width: '60px', objectFit: 'contain', marginBottom: '1rem' }} />
                            ) : (
                                <div style={{ height: '60px', width: '60px', background: '#30363d', borderRadius: '8px', marginBottom: '1rem' }}></div>
                            )}
                            <h4 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '1.2rem' }}>{p.title}</h4>
                            <div style={{ color: '#8b949e', fontSize: '0.9rem', marginBottom: '1rem' }}>
                                ID: {p.id} | Side: {p.side}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                                <button onClick={(e) => handleEditPart(p, e)} style={{ flex: 1, background: '#1f6feb', color: '#fff', border: 'none', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                                <button onClick={(e) => handleDeletePart(p.id, e)} style={{ flex: 1, background: 'transparent', color: '#ff7b72', border: '1px solid #f85149', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '10px', overflow: 'hidden' }}>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '0.8fr 1.5fr 0.8fr 0.8fr 0.9fr',
                            gap: '0.75rem',
                            padding: '0.85rem 1rem',
                            background: '#0d1117',
                            borderBottom: '1px solid #30363d',
                            fontSize: '0.72rem',
                            color: '#8b949e',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em'
                        }}
                    >
                        <div>Icon</div>
                        <div>Part</div>
                        <div>Side</div>
                        <div>Priority</div>
                        <div>Actions</div>
                    </div>

                    <div style={{ display: 'grid' }}>
                        {parts.map((p) => (
                            <div
                                key={p.id}
                                onClick={() => handleOpenPartDetails(p)}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '0.8fr 1.5fr 0.8fr 0.8fr 0.9fr',
                                    gap: '0.75rem',
                                    padding: '1rem',
                                    border: 'none',
                                    borderTop: '1px solid rgba(255,255,255,0.05)',
                                    background: 'transparent',
                                    color: '#e6edf3',
                                    textAlign: 'left',
                                    cursor: 'pointer'
                                }}
                            >
                                <div>
                                    {p.icon ? (
                                        <img src={p.icon} alt="" style={{ height: '40px', width: '40px', objectFit: 'contain' }} />
                                    ) : (
                                        <div style={{ height: '40px', width: '40px', borderRadius: '8px', background: '#30363d' }}></div>
                                    )}
                                </div>
                                <div>
                                    <div>{p.title}</div>
                                    <div style={{ fontSize: '0.76rem', color: '#8b949e', marginTop: '0.2rem' }}>ID: {p.id}</div>
                                </div>
                                <div>{p.side}</div>
                                <div>{p.priority ?? 0}</div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={(e) => handleEditPart(p, e)} style={{ background: '#1f6feb', color: '#fff', border: 'none', padding: '0.4rem 0.55rem', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
                                    <button onClick={(e) => handleDeletePart(p.id, e)} style={{ background: 'transparent', color: '#ff7b72', border: '1px solid #f85149', padding: '0.4rem 0.55rem', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {parts.length === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#8b949e', border: '1px dashed #30363d', borderRadius: '8px' }}>
                    No parts have been created yet. Click "Add New Part" to start.
                </div>
            )}


            {/* MODAL 1: Part Form Modal (Add / Edit) */}
            {showPartFormModal && (
                <div style={{ ...overlayStyle, zIndex: 1050 }}>
                    <div style={modalStyle}>
                        <button onClick={() => setShowPartFormModal(false)} style={closeBtnStyle}>&times;</button>
                        <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#fff' }}>{partId && selectedPart ? 'Edit Part' : 'Add New Part'}</h2>
                        <form onSubmit={handlePartSubmit}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#c9d1d9' }}>Part ID (e.g. shell, trimpiece): </label>
                                <input value={partId} onChange={e => setPartId(e.target.value)} required disabled={!!selectedPart && selectedPart.id === partId} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #30363d', background: '#0d1117', color: '#fff' }} />
                                {!!selectedPart && selectedPart.id === partId && <span style={{ fontSize: '0.8rem', color: '#8b949e' }}>ID cannot be changed after creation.</span>}
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#c9d1d9' }}>Title Display: </label>
                                <input value={partTitle} onChange={e => setPartTitle(e.target.value)} required style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #30363d', background: '#0d1117', color: '#fff' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#c9d1d9' }}>Priority (Z-Index order): </label>
                                    <input type="number" value={partPriority} onChange={e => setPartPriority(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #30363d', background: '#0d1117', color: '#fff' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#c9d1d9' }}>Side (front/back): </label>
                                    <select value={partSide} onChange={e => setPartSide(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #30363d', background: '#0d1117', color: '#fff' }}>
                                        <option value="front">Front</option>
                                        <option value="back">Back</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#c9d1d9' }}>Icon Image: </label>
                                <input type="file" accept="image/*" onChange={e => setPartIconFile(e.target.files[0])} style={{ color: '#fff' }} />
                                {partIconPreview && !partIconFile && <img src={partIconPreview} alt="Preview" style={{ height: '60px', marginTop: '1rem', display: 'block', background: '#21262d', padding: '0.5rem', borderRadius: '4px' }} />}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowPartFormModal(false)} style={{ padding: '0.6rem 1.2rem', background: 'transparent', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ padding: '0.6rem 1.2rem', background: '#238636', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Save Part</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: Part Details (Options Grid) */}
            {showDetailsModal && selectedPart && (
                <div style={overlayStyle}>
                    <div style={{ ...modalStyle, maxWidth: '1000px', height: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <button onClick={() => setShowDetailsModal(false)} style={closeBtnStyle}>&times;</button>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #30363d' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {selectedPart.icon && <img src={selectedPart.icon} alt="" style={{ height: '40px' }} />}
                                <div>
                                    <h2 style={{ margin: 0, color: '#fff' }}>{selectedPart.title} Options</h2>
                                    <span style={{ color: '#8b949e', fontSize: '0.9rem' }}>Side: {selectedPart.side} | ID: {selectedPart.id}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.4rem', fontWeight: 600 }}>Options ({subitems.length})</h3>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {/* --- Search Filter --- */}
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            value={subFilterQuery}
                                            onChange={e => setSubFilterQuery(e.target.value)}
                                            placeholder="Search name, barcode, item #"
                                            style={{ 
                                                background: '#0d1117', 
                                                border: '1px solid #30363d', 
                                                color: '#e6edf3', 
                                                padding: '0.5rem 0.75rem', 
                                                borderRadius: '6px', 
                                                fontSize: '0.85rem',
                                                minWidth: '220px'
                                            }}
                                        />
                                    </div>

                                    {/* --- Type Filter --- */}
                                    <select 
                                        value={subFilterType}
                                        onChange={e => setSubFilterType(e.target.value)}
                                        style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3', padding: '0.45rem', borderRadius: '6px', fontSize: '0.85rem' }}
                                    >
                                        <option value="all">All Types</option>
                                        <option value="color">Colors Only</option>
                                        <option value="gamemode">Gamemodes Only</option>
                                    </select>

                                    {/* --- Active Status Filter --- */}
                                    <select 
                                        value={subFilterActive}
                                        onChange={e => setSubFilterActive(e.target.value)}
                                        style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e6edf3', padding: '0.45rem', borderRadius: '6px', fontSize: '0.85rem' }}
                                    >
                                        <option value="all">All Status</option>
                                        <option value="active">Active Only</option>
                                        <option value="inactive">Inactive Only</option>
                                    </select>

                                    <button
                                        onClick={handleOpenAddOption}
                                        style={{ padding: '0.5rem 1rem', background: '#238636', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                                    >
                                        + Add Option
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                                {subitems
                                    .filter(sub => {
                                        // 1. Search Query (Name, Barcode, ItemNumber)
                                        const nName = (sub.name || '').toLowerCase();
                                        const nBarcode = (sub.barcode || '').toLowerCase();
                                        const nItemNum = (sub.itemNumber || '').toString().toLowerCase();
                                        const query = subFilterQuery.toLowerCase();
                                        const matchesQuery = nName.includes(query) || nBarcode.includes(query) || nItemNum.includes(query);

                                        // 2. Active Status
                                        const isActive = sub.active !== false;
                                        const matchesActive = subFilterActive === 'all' 
                                            || (subFilterActive === 'active' && isActive)
                                            || (subFilterActive === 'inactive' && !isActive);

                                        // 3. Type
                                        const matchesType = subFilterType === 'all' || sub.type === subFilterType;

                                        return matchesQuery && matchesActive && matchesType;
                                    })
                                    .map((sub) => (
                                    <div key={sub.id} style={{ background: '#21262d', padding: '1rem', borderRadius: '8px', border: '1px solid #30363d', display: 'flex', flexDirection: 'column' }}>

                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                                {sub.type === 'color' ? (
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: sub.hex || '#fff', border: '2px solid rgba(255,255,255,0.2)' }}></div>
                                                ) : (
                                                    sub.icon ? <img src={sub.icon} alt="" style={{ width: '32px', height: '32px', objectFit: 'contain' }} /> : <div style={{ width: '32px', height: '32px', background: '#333', borderRadius: '4px' }}></div>
                                                )}
                                                <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: '#30363d', borderRadius: '12px', color: '#c9d1d9' }}>{sub.type}</span>
                                            </div>

                                            <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {sub.name}
                                                {sub.active === false && <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#f8514933', color: '#ff7b72', borderRadius: '12px' }}>Inactive</span>}
                                            </div>
                                            <div style={{ fontSize: '0.82rem', color: '#8b949e' }}>#{padNumericString(sub.itemNumber)} · Barcode {sub.barcode}</div>
                                            <div style={{ fontSize: '0.9rem', color: '#8b949e' }}>Sell Price: <strong style={{ color: '#fff' }}>{formatInventoryMoney(sub.sellPrice ?? sub.price)}</strong></div>
                                            <div style={{ fontSize: '0.9rem', color: '#8b949e' }}>Purchase Price: <strong style={{ color: '#fff' }}>{formatInventoryMoney(sub.purchasePrice)}</strong></div>
                                            <div style={{ fontSize: '0.9rem', color: '#8b949e' }}>Qty: {sub.quantity}</div>

                                            {sub.image ? (
                                                <div style={{ marginTop: '0.5rem', background: '#0d1117', borderRadius: '4px', padding: '4px', textAlign: 'center' }}>
                                                    <span style={{ fontSize: '0.7rem', color: '#8b949e', display: 'block' }}>Overlay Present</span>
                                                </div>
                                            ) : (
                                                <div style={{ marginTop: '0.5rem', border: '1px dashed #30363d', borderRadius: '4px', padding: '4px', textAlign: 'center' }}>
                                                    <span style={{ fontSize: '0.7rem', color: '#8b949e', display: 'block' }}>No Overlay Image</span>
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                            <button onClick={() => handleEditSubitem(sub)} style={{ flex: 1, background: '#30363d', color: '#c9d1d9', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
                                            <button onClick={() => handleDeleteSubitem(sub.id)} style={{ flex: 1, background: 'transparent', color: '#ff7b72', border: '1px solid #f85149', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                                        </div>
                                    </div>
                                ))}
                                {subitems.length === 0 && (
                                    <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: '#8b949e', background: '#21262d', borderRadius: '8px', border: '1px dashed #30363d' }}>
                                        No options created for this part yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: Option Form Modal (Add/Edit Option) */}
            {showOptionFormModal && selectedPart && (
                <div style={{ ...overlayStyle, zIndex: 1100 }}>
                    <div style={modalStyle}>
                        <button onClick={() => setShowOptionFormModal(false)} style={closeBtnStyle}>&times;</button>
                        <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#fff' }}>{editSubId ? 'Edit Option' : 'Add New Option'} <span style={{ fontSize: '1rem', color: '#8b949e', fontWeight: 'normal' }}>- {selectedPart.title}</span></h2>

                        <form onSubmit={handleSubitemSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#c9d1d9' }}>Item Number:</label>
                                    <input value={padNumericString(subItemNumber) || 'Auto-generated on save'} readOnly style={{ ...fieldStyle, color: '#8b949e' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#c9d1d9' }}>Barcode:</label>
                                    <input value={padNumericString(subBarcode) || padNumericString(subItemNumber) || 'Matches item number on save'} readOnly style={{ ...fieldStyle, color: '#8b949e' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#c9d1d9' }}>Option Name (e.g. Red, Turbo):</label>
                                    <input value={subName} onChange={e => setSubName(e.target.value)} required style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #30363d', background: '#0d1117', color: '#fff' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#c9d1d9' }}>Type:</label>
                                    <select value={subType} onChange={e => setSubType(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #30363d', background: '#0d1117', color: '#fff' }}>
                                        <option value="color">Color</option>
                                        <option value="gamemode">Game Mode / Performance</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.8rem' }}>
                                    <input 
                                        type="checkbox" 
                                        id="subActiveCheck" 
                                        checked={subActive} 
                                        onChange={e => setSubActive(e.target.checked)} 
                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }} 
                                    />
                                    <label htmlFor="subActiveCheck" style={{ color: '#c9d1d9', cursor: 'pointer', userSelect: 'none' }}>Active (Visible to users)</label>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#c9d1d9' }}>Purchase Price:</label>
                                    <input type="number" step="0.01" min="0" value={subPurchasePrice} onChange={e => setSubPurchasePrice(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #30363d', background: '#0d1117', color: '#fff' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#c9d1d9' }}>Sell Price:</label>
                                    <input type="number" step="0.01" min="0" value={subSellPrice} onChange={e => setSubSellPrice(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #30363d', background: '#0d1117', color: '#fff' }} />
                                </div>

                                {subType === 'color' ? (
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#c9d1d9' }}>Color Hex (Palette Swatch):</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <input type="color" value={subColorHex} onChange={e => setSubColorHex(e.target.value)} style={{ width: '40px', height: '40px', padding: '0', cursor: 'pointer', border: 'none', borderRadius: '4px' }} />
                                            <input type="text" value={subColorHex} onChange={e => setSubColorHex(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #30363d', background: '#0d1117', color: '#fff' }} placeholder="#RRGGBB" />
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#c9d1d9' }}>Gamemode Icon Image:</label>
                                        <input type="file" accept="image/*" onChange={e => setSubIconFile(e.target.files[0])} style={{ color: '#fff' }} />
                                        {subIconPreview && !subIconFile && <img src={subIconPreview} alt="Preview" style={{ height: '40px', marginTop: '0.5rem', display: 'block', background: '#21262d', padding: '4px', borderRadius: '4px' }} />}
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <InventoryPricingEditor
                                    rows={subInventoryDetails}
                                    onChange={setSubInventoryDetails}
                                    title="Inventory"
                                    description="Add stock movements with quantity, date, and reason. Sell price is managed separately and is the customer-facing price."
                                />
                            </div>

                            {subType === 'gamemode' && (
                                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                                    <h3 style={{ marginTop: 0, color: '#fff', fontSize: '1.1rem', marginBottom: '1rem' }}>Gamemode Dependencies & Rules</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <input 
                                                    type="checkbox" 
                                                    id="subAllowsMultiple" 
                                                    checked={subAllowsMultiple} 
                                                    onChange={e => setSubAllowsMultiple(e.target.checked)} 
                                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                />
                                                <label htmlFor="subAllowsMultiple" style={{ color: '#c9d1d9', cursor: 'pointer' }}>Allow Multiple Selections</label>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#8b949e' }}>If enabled, this option won't automatically deselect other gamemodes unless they share the same group.</p>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <input 
                                                    type="checkbox" 
                                                    id="subDisablesColors" 
                                                    checked={subDisablesColors} 
                                                    onChange={e => setSubDisablesColors(e.target.checked)} 
                                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                />
                                                <label htmlFor="subDisablesColors" style={{ color: '#c9d1d9', cursor: 'pointer' }}>Disable Color Customization</label>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#8b949e' }}>If enabled, selecting this option will hide the color palettes for this part.</p>
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#c9d1d9' }}>Exclusive Group Name:</label>
                                            <input 
                                                value={subExclusiveGroup} 
                                                onChange={e => setSubExclusiveGroup(e.target.value)} 
                                                placeholder="e.g. TriggerMechanism"
                                                style={{ ...fieldStyle }} 
                                            />
                                            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.8rem', color: '#8b949e' }}>Options in the same group are mutually exclusive (Standard radio button behavior).</p>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.8rem', color: '#c9d1d9', fontWeight: 600 }}>Incompatible with:</label>
                                            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', padding: '0.5rem' }}>
                                                {subitems
                                                    .filter(item => item.id !== editSubId && item.type === 'gamemode') // Show only gamemode options
                                                    .map(item => (
                                                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                            <input 
                                                                type="checkbox" 
                                                                id={`incompat-${item.id}`}
                                                                checked={subIncompatibleWith.includes(item.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSubIncompatibleWith([...subIncompatibleWith, item.id]);
                                                                    } else {
                                                                        setSubIncompatibleWith(subIncompatibleWith.filter(i => i !== item.id));
                                                                    }
                                                                }}
                                                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                            />
                                                            <label htmlFor={`incompat-${item.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#e6edf3', cursor: 'pointer', flex: 1 }}>
                                                                {item.icon && <img src={item.icon} alt="" style={{ height: '24px', width: '24px', objectFit: 'contain', background: '#21262d', borderRadius: '3px' }} />}
                                                                <span style={{ fontSize: '0.85rem' }}>{item.name}</span>
                                                                <span style={{ fontSize: '0.7rem', color: '#8b949e' }}>({item.id})</span>
                                                            </label>
                                                        </div>
                                                    ))
                                                }
                                                {subitems.filter(item => item.id !== editSubId && item.type === 'gamemode').length === 0 && (
                                                    <div style={{ padding: '1rem', textAlign: 'center', color: '#8b949e', fontSize: '0.85rem' }}>No other gamemode options available for this part.</div>
                                                )}
                                            </div>
                                            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#8b949e' }}>Select items that cannot be active at the same time as this one.</p>
                                        </div>

                                    </div>
                                </div>
                            )}

                            <div style={{ background: '#0d1117', padding: '1rem', borderRadius: '8px', border: '1px solid #30363d', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '250px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.25rem', color: '#c9d1d9', fontWeight: 600 }}>Primary Overlay Image (.png):</label>
                                    <span style={{ fontSize: '0.8rem', color: '#8b949e', display: 'block', marginBottom: '1rem' }}>Applied to the <strong>{selectedPart.side}</strong> side of the controller.</span>
                                    <input type="file" accept="image/png,image/*" onChange={e => setSubImageFile(e.target.files[0])} style={{ color: '#fff' }} />
                                    {subImagePreview && !subImageFile && <img src={subImagePreview} alt="Preview" style={{ height: '80px', marginTop: '1rem', display: 'block', background: '#000', padding: '0.5rem', borderRadius: '4px' }} />}
                                </div>
                                <div style={{ flex: 1, minWidth: '250px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.25rem', color: '#c9d1d9', fontWeight: 600 }}>Secondary Overlay Image (.png):</label>
                                    <span style={{ fontSize: '0.8rem', color: '#8b949e', display: 'block', marginBottom: '1rem' }}>Applied to the <strong>{selectedPart.side === 'front' ? 'back' : 'front'}</strong> side of the controller.</span>
                                    <input type="file" accept="image/png,image/*" onChange={e => setSubSecondImageFile(e.target.files[0])} style={{ color: '#fff' }} />
                                    {subSecondImagePreview && !subSecondImageFile && <img src={subSecondImagePreview} alt="Preview" style={{ height: '80px', marginTop: '1rem', display: 'block', background: '#000', padding: '0.5rem', borderRadius: '4px' }} />}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowOptionFormModal(false)} style={{ padding: '0.6rem 1.2rem', background: 'transparent', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ padding: '0.6rem 1.2rem', background: '#1f6feb', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                                    {editSubId ? 'Update Option' : 'Save Option'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminParts;
