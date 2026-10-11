import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Spec: operator-console-modular-components-v1.md — AC79.
function inspectSharedFields(relativeFile: string) {
  const file = path.resolve(__dirname, '../apps/operator-console/src', relativeFile);
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations: string[] = [];
  let fields = 0;
  function visit(node: ts.Node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ['Input', 'SearchInput'].includes(node.tagName.getText(source))) {
      fields++;
      for (const attribute of node.attributes.properties) {
        if (ts.isJsxAttribute(attribute) && ['className', 'style'].includes(attribute.name.getText(source))) violations.push(attribute.name.getText(source));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { fields, violations, text };
}

describe('Feature: Action-button modularity (AC79)', () => {
  it.each(['components/AutomationBuilderIdentityField', 'components/AutomationBuilderTriggerSection', 'components/AutomationWorkbenchForm', 'components/DashboardCreateForm', 'components/InlineTabCreator', 'components/DashboardTitleBar', 'components/dashboardViewConfig/DashboardViewSettingsTab', 'components/UserProfileModal', 'components/AssistantActionModal', 'views/topology/TopologyRoomDetailPanel', 'views/LoginView', 'views/FirstAdminSetupView', 'views/TopologyView'])('Scenario: adopted fields in %s retain central input styling', component => {
    const { fields, violations } = inspectSharedFields(`${component}.tsx`);
    expect(fields).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });
  it.each(['views/RoutinesView.tsx', 'components/ui/SearchFilterBar.tsx', 'components/DashboardViewConfigModal.tsx', 'views/dashboards/widgets/SectionCardEditorModal.tsx', 'components/SceneDeviceSelector.tsx', 'components/DeviceInspectorHeader.tsx', 'components/ModbusConnectionCard.tsx'])('Scenario: adopted segmented consumer %s delegates visual styling to its primitive', relativeFile => {
    const file = path.resolve(__dirname, '../apps/operator-console/src', relativeFile);
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const violations: string[] = [];
    let controls = 0;
    function visit(node: ts.Node) {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === 'SegmentedControl') {
        controls += 1;
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute)) continue;
          const name = attribute.name.getText(source);
          if (name === 'optionClassName' || name === 'style') violations.push(name);
          if (name === 'className') {
            const initializer = attribute.initializer;
            if (!initializer || !ts.isStringLiteral(initializer)) { violations.push('dynamic className'); continue; }
            for (const token of initializer.text.split(/\s+/)) {
              if (!/^(w-fit|w-full|xl:w-auto|max-w-full|min-w-0|flex-1|shrink-0)$/.test(token)) violations.push(token);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    expect(controls).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });
  it.each(['SectionCardCatalogModal', 'SectionCardEditorModal'])('Scenario: card editor %s retains central input styling', component => {
    const { fields, violations } = inspectSharedFields(`views/dashboards/widgets/${component}.tsx`);
    expect(fields).toBeGreaterThan(0);
    expect(violations).toEqual([]);
    const css = fs.readFileSync(path.resolve(__dirname, '../apps/operator-console/src/index.css'), 'utf8');
    expect(css).not.toContain('.card-editor-tabs');
  });
  it.each(['views/SceneBuilderModal.tsx', 'components/SceneDeviceSelector.tsx', 'components/RoutineSharingField.tsx', 'components/EventFilters.tsx', 'components/DeviceInspectorHeader.tsx'])('Scenario: routine and event fields in %s retain the central surface', relativeFile => {
    const { fields, violations, text } = inspectSharedFields(relativeFile);
    expect(fields).toBeGreaterThan(0);
    expect(violations).toEqual([]);
    expect(text).not.toContain('[&_label]:');
  });
  it('Scenario: option cards retain central styling and radio implementations stay in the primitives', () => {
    const violations: string[] = [];
    const sourceRoot = path.resolve(__dirname, '../apps/operator-console/src');
    function inspect(directory: string) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) { inspect(file); continue; }
        if (!file.endsWith('.tsx') || file.includes('.test.')) continue;
        const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        function visit(node: ts.Node) {
          if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            const tag = node.tagName.getText(source);
            for (const property of node.attributes.properties) {
              if (!ts.isJsxAttribute(property)) continue;
              const name = property.name.getText(source);
              if (tag === 'SelectableOptionCard' && ['className', 'titleClassName', 'descriptionClassName', 'style'].includes(name)) {
                violations.push(`${path.relative(sourceRoot, file)}: local option-card style ${name}`);
              }
              if (name === 'role' && property.initializer && ts.isStringLiteral(property.initializer) && property.initializer.text === 'radio'
                && !/ui[/\\](SelectableOptionCard|SegmentedControl)\.tsx$/.test(file)) {
                violations.push(`${path.relative(sourceRoot, file)}: local radio implementation`);
              }
            }
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
    inspect(sourceRoot);
    const assistant = fs.readFileSync(path.join(sourceRoot, 'components/AssistantActionModal.tsx'), 'utf8');
    expect(assistant).toContain('<SelectableOptionCard');
    expect(assistant).not.toContain('<SurfaceButton');
    expect(violations).toEqual([]);
  });
  it('Scenario: consumers do not redeclare action-button geometry or typography', () => {
    const violations: string[] = [];
    const sourceRoot = path.resolve(__dirname, '../apps/operator-console/src');
    function inspect(directory: string) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) { inspect(file); continue; }
        if (!file.endsWith('.tsx') || file.includes('.test.') || /ui[/\\](Button|IconButton)\.tsx$/.test(file)) continue;
        const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        function visit(node: ts.Node) {
          if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            const tag = node.tagName.getText(source);
            if (tag === 'Button' || tag === 'IconButton') {
              const attribute = node.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(source) === 'className');
              if (attribute) {
                function inspectClasses(child: ts.Node) {
                  if (ts.isStringLiteral(child)) {
                    for (const token of child.text.split(/\s+/)) {
                      const base = token.split(':').pop()?.replace(/^!/, '') ?? '';
                      if (/^(rounded(?:-|$)|(?:min-|max-)?h-|p[xytrblse]?-|gap(?:-[xy])?-|font-(?:sans|mono|serif|normal|medium|semibold|bold|extrabold|black)|text-(?:xs|sm|base|lg|xl|[2-9]xl|micro|label|caption|body)|leading-|tracking-|uppercase$|shadow(?:-|$)|(?:translate|scale)-)/.test(base)
                        || (tag === 'IconButton' && /^(?:min-|max-)?w-/.test(base))) {
                        violations.push(`${path.relative(sourceRoot, file)}: ${token}`);
                      }
                    }
                  } else ts.forEachChild(child, inspectClasses);
                }
                inspectClasses(attribute);
              }
            }
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
    inspect(sourceRoot);
    expect(violations).toEqual([]);
  });
});
