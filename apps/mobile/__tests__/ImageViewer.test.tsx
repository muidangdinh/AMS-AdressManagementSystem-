import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import ImageViewer from '../src/components/ImageViewer';

test('renders photos and closes', async () => {
  const onClose = jest.fn();
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <ImageViewer visible uris={['a.jpg', 'b.jpg']} initialIndex={1} onClose={onClose} />,
    );
  });

  ReactTestRenderer.act(() => {
    tree.root.findAllByProps({ accessibilityLabel: 'Đóng' })[0].props.onPress();
  });
  expect(onClose).toHaveBeenCalled();
});

test('renders nothing without photos', async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<ImageViewer visible uris={[]} onClose={jest.fn()} />);
  });
  expect(tree.toJSON()).toBeNull();
});
