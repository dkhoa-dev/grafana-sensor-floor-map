import React from 'react';
import { render } from '@testing-library/react';
import { StandardEditorProps } from '@grafana/data';
import { SensorFloorOptions } from '../types';
import { FloorPlanOption } from './FloorPlanOption';
import { expectInert, HOSTILE_PLAN } from '../svg/hostile.testutil';

type Props = StandardEditorProps<string, unknown, SensorFloorOptions>;

describe('FloorPlanOption', () => {
  it('cleans the plan before showing its preview', () => {
    const props = { value: HOSTILE_PLAN, onChange: jest.fn(), context: { data: [] }, item: {} } as unknown as Props;
    const { container } = render(<FloorPlanOption {...props} />);
    expectInert(container);
    expect(container.querySelector('path[d="M0 0 L50 50"]')).not.toBeNull();
  });
});
