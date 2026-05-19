update public.collection_models m
set color_name = case right(m.model_code, 1)
  when '1' then 'Темно-синий'
  when '2' then 'Графит'
  when '3' then 'Светло-бежевый'
  when '4' then 'Серый'
  when '5' then 'Шоколад'
  when '6' then 'Изумруд'
  when '7' then 'Бордовый'
  when '8' then 'Молочный'
  when '9' then 'Песочный'
  else coalesce(m.color_name, 'Темно-синий')
end,
color_hex = case right(m.model_code, 1)
  when '1' then '#1E3A8A'
  when '2' then '#374151'
  when '3' then '#D6C5A1'
  when '4' then '#9CA3AF'
  when '5' then '#7C3F2A'
  when '6' then '#0F766E'
  when '7' then '#7F1D1D'
  when '8' then '#F3F4F6'
  when '9' then '#D4B483'
  else coalesce(m.color_hex, '#1E3A8A')
end;

update public.collection_models m
set price_per_m2 = greatest(
  0,
  coalesce(c.price_per_m2, 0) + ((ascii(right(m.model_code, 1)) % 5) * 50)
)
from public.collections c
where c.id = m.collection_id;
