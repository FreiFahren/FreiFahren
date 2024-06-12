import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import ReportButton from '../../../components/Buttons/ReportButton/ReportButton';

describe('ReportButton', () => {
  test('calls onClick prop when clicked', () => {
    // Mock the onClick handler
    const handleClick = jest.fn();

    // Render the ReportButton with the mock handler
    render(<ReportButton onClick={handleClick} />);

    // Get the button element and simulate a click event
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Assert that the handler was called exactly once
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
