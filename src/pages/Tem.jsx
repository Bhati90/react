import React, { useState } from 'react';
import axios from 'axios';
import './Tem.css';

const API_URL = 'https://workcrop.onrender.com/register/whatsapp';

const IndependentTemplateGenerator = () => {
  const [step, setStep] = useState(1); // 1: Requirements, 2: Select Template, 3: Customize, 4: Submit
  const [requirements, setRequirements] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [templateOptions, setTemplateOptions] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [customizedTemplate, setCustomizedTemplate] = useState(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [wantsToAddMedia, setWantsToAddMedia] = useState(false);
  const [wantsToRemoveMedia, setWantsToRemoveMedia] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);


  // Add a button to the BUTTONS component, or create one if absent
const addTemplateButton = () => {
  setCustomizedTemplate(prev => {
    let comps = [...prev.components];
    let btnIdx = comps.findIndex(c => c.type === 'BUTTONS');
    if (btnIdx === -1) {
      // Add new BUTTONS
      comps.push({
        type: 'BUTTONS',
        buttons: [{ type: 'QUICK_REPLY', text: 'New Button' }]
      });
    } else {
      let buttons = comps[btnIdx].buttons || [];
      if (buttons.length < 3) { // WhatsApp max 3
        buttons = [...buttons, { type: 'QUICK_REPLY', text: 'New Button' }];
        comps[btnIdx] = { ...comps[btnIdx], buttons };
      }
    }
    return { ...prev, components: comps };
  });
};

// Remove a button by index; remove the BUTTONS component if no buttons left
const removeTemplateButton = (btnIndex) => {
  setCustomizedTemplate(prev => {
    let comps = [...prev.components];
    let btnIdx = comps.findIndex(c => c.type === 'BUTTONS');
    if (btnIdx !== -1) {
      let buttons = comps[btnIdx].buttons.filter((_, i) => i !== btnIndex);
      if (buttons.length === 0) {
        comps.splice(btnIdx, 1); // Remove entire BUTTONS block
      } else {
        comps[btnIdx] = { ...comps[btnIdx], buttons };
      }
    }
    return { ...prev, components: comps };
  });
};

  // Step 1: Generate template options
  const handleGenerateTemplates = async () => {
    if (!requirements.trim()) {
      alert('Please describe your requirements');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await axios.post(`${API_URL}/api/template-generator/generate/`, {
        requirements
      });

      if (response.data.status === 'success') {
        setTemplateOptions(response.data.templates);
        setStep(2);
      }
    } catch (error) {
      alert('Error generating templates: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsGenerating(false);
    }
  };

  // Step 2: Select a template
  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setCustomizedTemplate(JSON.parse(JSON.stringify(template))); // Deep copy
    
    // Check if template has media
    const hasMediaHeader = template.components.some(
      comp => comp.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format)
    );
    
    setWantsToAddMedia(!hasMediaHeader);
    setWantsToRemoveMedia(false);
    setMediaFile(null);
    
    setStep(3);
  };

  // Step 3: Customize template
  const updateTemplateField = (field, value) => {
    setCustomizedTemplate(prev => ({ ...prev, [field]: value }));
  };

  const updateComponent = (index, field, value) => {
    setCustomizedTemplate(prev => {
      const newComponents = [...prev.components];
      newComponents[index] = { ...newComponents[index], [field]: value };
      return { ...prev, components: newComponents };
    });
  };

  const toggleComponentRemoval = (index) => {
    setCustomizedTemplate(prev => {
      const newComponents = [...prev.components];
      newComponents[index] = {
        ...newComponents[index],
        removed: !newComponents[index].removed
      };
      return { ...prev, components: newComponents };
    });
  };

  const handleMediaToggle = () => {
    if (wantsToAddMedia) {
      // User wants to add media
      setWantsToRemoveMedia(false);
      
      // Add HEADER component if not exists
      const hasHeader = customizedTemplate.components.some(c => c.type === 'HEADER');
      if (!hasHeader) {
        setCustomizedTemplate(prev => ({
          ...prev,
          components: [
            {
              type: 'HEADER',
              format: 'IMAGE',
              optional: false
            },
            ...prev.components
          ]
        }));
      } else {
        // Update existing header to IMAGE
        updateComponent(
          customizedTemplate.components.findIndex(c => c.type === 'HEADER'),
          'format',
          'IMAGE'
        );
      }
    } else {
      // User wants to remove media
      setWantsToRemoveMedia(true);
      setMediaFile(null);
      
      // Mark header as removed
      const headerIndex = customizedTemplate.components.findIndex(c => c.type === 'HEADER');
      if (headerIndex !== -1) {
        toggleComponentRemoval(headerIndex);
      }
    }
  };

  // Step 4: Submit to Meta
  const handleSubmit = async () => {
    // Validate
    const hasMediaHeader = customizedTemplate.components.some(
      comp => comp.type === 'HEADER' && 
      ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format) &&
      !comp.removed
    );

    if (hasMediaHeader && !mediaFile && !wantsToRemoveMedia) {
      alert('Please upload media file or remove the media header');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      
      const templatePayload = {
        ...customizedTemplate,
        remove_media: wantsToRemoveMedia
      };
      
      formData.append('template_data', JSON.stringify(templatePayload));
      
      if (mediaFile && !wantsToRemoveMedia) {
        formData.append('media_file', mediaFile);
      }

      const response = await axios.post(
        `${API_URL}/api/template-generator/submit/`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      if (response.data.status === 'success') {
        alert(`Template submitted successfully!\nTemplate ID: ${response.data.template_id}\nStatus: Pending approval`);
        // Reset or navigate
        setStep(1);
        setRequirements('');
        setTemplateOptions([]);
        setSelectedTemplate(null);
        setCustomizedTemplate(null);
        setMediaFile(null);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      const suggestion = error.response?.data?.suggestion || '';
      alert(`Error: ${errorMsg}\n\nSuggestion: ${suggestion}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="step-content">
            <h2>🎯 Describe Your Template Requirements</h2>
            <p>Tell us what you want your WhatsApp template to achieve. AI will generate multiple options for you.</p>
            
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="Example: I need a template for farmer outreach about seasonal grape harvesting labor services in Nashik region. Should be in Marathi, include farmer name and location variables, and have service details."
              rows={6}
              className="requirements-textarea"
            />

            <div className="example-prompts">
              <p><strong>💡 Quick Examples:</strong></p>
              <button
                className="prompt-chip"
                onClick={() => setRequirements("Create a promotional template for grape farmers in Nashik about harvesting labor services. Include details about skilled workers, services offered, and call-to-action buttons. Use Marathi language with personalization.")}
              >
                🍇 Farmer Labor Service (Marathi)
              </button>
              <button
                className="prompt-chip"
                onClick={() => setRequirements("E-commerce order confirmation template with order number, items, delivery address, and estimated delivery time. Should have order tracking button.")}
              >
                📦 Order Confirmation
              </button>
              <button
                className="prompt-chip"
                onClick={() => setRequirements("Appointment reminder for dental clinic. Include patient name, appointment date/time, and confirmation/reschedule buttons.")}
              >
                🦷 Appointment Reminder
              </button>
            </div>

            <button 
              onClick={handleGenerateTemplates} 
              disabled={isGenerating}
              className="primary-button generate-btn"
            >
              {isGenerating ? (
                <>
                  <span className="spinner"></span> Generating Templates...
                </>
              ) : (
                '✨ Generate Template Options'
              )}
            </button>
          </div>
        );

      case 2:
        return (
          <div className="step-content">
            <h2>📋 Choose Your Template</h2>
            <p>Select the template that best fits your needs. You can customize it in the next step.</p>

            <div className="template-options-grid">
              {templateOptions.map((template, index) => (
                <div
                  key={template.id}
                  className={`template-option-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                  onClick={() => handleSelectTemplate(template)}
                >
                  <div className="template-card-header">
                    <h3>
                      {template.source === 'existing' && '🔄 '}
                      Option {index + 1}
                    </h3>
                    {template.source === 'existing' && (
                      <span className="existing-badge">Existing</span>
                    )}
                    {template.has_media && (
                      <span className="media-badge">📷 {template.media_type}</span>
                    )}
                  </div>

                  <p className="template-description">{template.description}</p>

                  <div className="template-preview">
                    {template.components.map((comp, i) => {
                      if (comp.type === 'BODY') {
                        return (
                          <div key={i} className="preview-body">
                            {comp.text.substring(0, 150)}
                            {comp.text.length > 150 && '...'}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>

                  <div className="template-meta">
                    <span className="meta-item">📝 {template.language.toUpperCase()}</span>
                    <span className="meta-item">📂 {template.category}</span>
                    {template.variables_needed && (
                      <span className="meta-item">
                        🏷️ {template.variables_needed.length} variables
                      </span>
                    )}
                  </div>

                  <div className="pros-cons">
                    <div className="pros">
                      <strong>✅ Pros:</strong>
                      <ul>
                        {template.pros?.slice(0, 2).map((pro, i) => (
                          <li key={i}>{pro}</li>
                        ))}
                      </ul>
                    </div>
                    {template.cons && template.cons.length > 0 && (
                      <div className="cons">
                        <strong>⚠️ Cons:</strong>
                        <ul>
                          {template.cons.slice(0, 2).map((con, i) => (
                            <li key={i}>{con}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <button
                    className="select-button"
                    onClick={() => handleSelectTemplate(template)}
                  >
                    Select & Customize
                  </button>
                </div>
              ))}
            </div>

            <button onClick={() => setStep(1)} className="secondary-button back-btn">
              ← Back to Requirements
            </button>
          </div>
        );

      case 3:
        return (
          <div className="step-content customize-step">
            <h2>✏️ Customize Your Template</h2>
            <p>Make any changes you want before submitting to Meta for approval.</p>

            <div className="customization-area">
              {/* Basic Info */}
              <div className="customize-section">
                <h3>Basic Information</h3>
                
                <div className="field-group">
                  <label>Template Name:</label>
                  <input
                    type="text"
                    value={customizedTemplate?.name || ''}
                    onChange={(e) => updateTemplateField('name', e.target.value)}
                    placeholder="my_template_name"
                  />
                  <small>Lowercase letters, numbers, and underscores only</small>
                </div>

                <div className="field-row">
                  <div className="field-group">
                    <label>Language:</label>
                    <select
                      value={customizedTemplate?.language || 'en'}
                      onChange={(e) => updateTemplateField('language', e.target.value)}
                    >
                      <option value="en">English</option>
                      <option value="hi">Hindi/Marathi</option>
                      <option value="es">Spanish</option>
                      <option value="pt_BR">Portuguese (Brazil)</option>
                    </select>
                  </div>

                  <div className="field-group">
                    <label>Category:</label>
                    <select
                      value={customizedTemplate?.category || 'UTILITY'}
                      onChange={(e) => updateTemplateField('category', e.target.value)}
                    >
                      <option value="UTILITY">Utility</option>
                      <option value="MARKETING">Marketing</option>
                      <option value="AUTHENTICATION">Authentication</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Media Control */}
              <div className="customize-section media-section">
                <h3>Media Header</h3>
                
                {customizedTemplate?.has_media && !wantsToRemoveMedia ? (
                  <div className="media-control">
                    <p>This template includes a {customizedTemplate.media_type} header.</p>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setWantsToRemoveMedia(true);
                        const headerIndex = customizedTemplate.components.findIndex(c => c.type === 'HEADER');
                        if (headerIndex !== -1) {
                          toggleComponentRemoval(headerIndex);
                        }
                      }}
                    >
                      🗑️ Remove Media Header
                    </button>

                    <div className="field-group mt-3">
                      <label>Upload {customizedTemplate.media_type}:</label>
                      <input
                        type="file"
                        accept={
                          customizedTemplate.media_type === 'IMAGE' ? 'image/*' :
                          customizedTemplate.media_type === 'VIDEO' ? 'video/*' :
                          '*/*'
                        }
                        onChange={(e) => setMediaFile(e.target.files[0])}
                      />
                      {mediaFile && (
                        <small className="file-selected">✓ {mediaFile.name}</small>
                      )}
                    </div>
                  </div>
                ) : wantsToRemoveMedia ? (
                  <div className="media-control">
                    <p className="text-muted">Media header removed.</p>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setWantsToRemoveMedia(false);
                        const headerIndex = customizedTemplate.components.findIndex(c => c.type === 'HEADER');
                        if (headerIndex !== -1) {
                          setCustomizedTemplate(prev => {
                            const newComponents = [...prev.components];
                            newComponents[headerIndex] = {
                              ...newComponents[headerIndex],
                              removed: false
                            };
                            return { ...prev, components: newComponents };
                          });
                        }
                      }}
                    >
                      ↩️ Add Media Back
                    </button>
                  </div>
                ) : (
                  <div className="media-control">
                    <p>No media header in this template.</p>
                    <button
                      className="primary-button-outline"
                      onClick={() => {
                        setWantsToAddMedia(true);
                        // Add header component
                        setCustomizedTemplate(prev => ({
                          ...prev,
                          has_media: true,
                          media_type: 'IMAGE',
                          components: [
                            {
                              type: 'HEADER',
                              format: 'IMAGE',
                              optional: false
                            },
                            ...prev.components.filter(c => c.type !== 'HEADER')
                          ]
                        }));
                      }}
                    >
                      ➕ Add Image Header
                    </button>

                    {wantsToAddMedia && (
                      <div className="field-group mt-3">
                        <label>Upload Image:</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setMediaFile(e.target.files[0])}
                        />
                        {mediaFile && (
                          <small className="file-selected">✓ {mediaFile.name}</small>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Components Editor */}
              <div className="customize-section">
                <h3>Template Components</h3>

                {customizedTemplate?.components?.map((component, index) => {
                  if (component.removed) return null;

                  return (
                    <div key={index} className="component-editor">
                      <div className="component-header">
                        <h4>{component.type}</h4>
                        {component.optional && (
                          <button
                            className="remove-component-btn"
                            onClick={() => toggleComponentRemoval(index)}
                            title="Remove this component"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {component.type === 'HEADER' && component.format === 'TEXT' && (
                        <input
                          type="text"
                          value={component.text || ''}
                          onChange={(e) => updateComponent(index, 'text', e.target.value)}
                          placeholder="Header text"
                          className="component-input"
                        />
                      )}

                      {component.type === 'BODY' && (
                        <>
                          <textarea
                            value={component.text || ''}
                            onChange={(e) => updateComponent(index, 'text', e.target.value)}
                            rows={6}
                            placeholder="Body text with {{1}}, {{2}} variables"
                            className="component-textarea"
                          />
                          {component.example && (
                            <small className="help-text">
                              Example values: {component.example.body_text?.[0]?.join(', ')}
                            </small>
                          )}
                        </>
                      )}

                      {component.type === 'FOOTER' && (
                        <input
                          type="text"
                          value={component.text || ''}
                          onChange={(e) => updateComponent(index, 'text', e.target.value)}
                          placeholder="Footer text (max 60 chars)"
                          maxLength={60}
                          className="component-input"
                        />
                      )}

                      {component.type === 'BUTTONS' && (
  <div className="buttons-editor">
    <div style={{marginBottom: 8, fontWeight: 500}}>Buttons (max 3):</div>
    {component.buttons?.map((btn, btnIndex) => (
      <div key={btnIndex} className="button-item" style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6}}>
        <span className="button-type-badge">{btn.type}</span>
        <input
          type="text"
          value={btn.text}
          onChange={e => {
            // Update button text
            const newButtons = [...component.buttons];
            newButtons[btnIndex] = { ...newButtons[btnIndex], text: e.target.value };
            updateComponent(index, 'buttons', newButtons);
          }}
          placeholder="Button text"
          maxLength={20}
        />
        <button
          type="button"
          title="Remove button"
          onClick={() => removeTemplateButton(btnIndex)}
          style={{padding: "0 10px", color: "#fff", background: "#dc3545", border: "none", borderRadius: 4, cursor: "pointer"}}
        >
          ✕
        </button>
      </div>
    ))}
    {(!component.buttons || component.buttons.length < 3) && (
      <button
        type="button"
        onClick={addTemplateButton}
        className="add-button-btn"
        style={{marginTop: 10, background: "#3576ff", color: "#fff", border: "none", borderRadius: 4, padding: "6px 12px"}}
      >
        + Add Button
      </button>
    )}
  </div>
)}

                    </div>
                  );
                })}
              </div>

              {/* Variables Info */}
              {customizedTemplate?.variables_needed && customizedTemplate.variables_needed.length > 0 && (
                <div className="customize-section variables-info">
                  <h3>📝 Variables in Template</h3>
                  <div className="variables-list">
                    {customizedTemplate.variables_needed.map((v, i) => (
                      <div key={i} className="variable-item">
                        <code>{'{{' + v.position + '}}'}</code>
                        <div className="variable-details">
                          <strong>{v.name}</strong>
                          <p>{v.description}</p>
                          <small>Example: {v.example}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="button-group">
              <button onClick={() => setStep(2)} className="secondary-button">
                ← Back to Options
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="primary-button submit-btn"
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-small"></span> Submitting...
                  </>
                ) : (
                  '🚀 Submit to Meta'
                )}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="independent-template-generator">
      <div className="header">
        <h1>🤖 AI Template Generator</h1>
        <p>Generate multiple template options and customize them before submission</p>
      </div>

      <div className="progress-indicator">
        <div className={`step-indicator ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
          <span className="step-number">1</span>
          <span className="step-label">Requirements</span>
        </div>
        <div className={`step-indicator ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
          <span className="step-number">2</span>
          <span className="step-label">Choose</span>
        </div>
        <div className={`step-indicator ${step >= 3 ? 'active' : ''}`}>
          <span className="step-number">3</span>
          <span className="step-label">Customize</span>
        </div>
      </div>

      <div className="content-area">
        {renderStepContent()}
      </div>
    </div>
  );
};

export default IndependentTemplateGenerator;