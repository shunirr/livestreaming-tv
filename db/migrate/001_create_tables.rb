class CreateTables < ActiveRecord::Migration
  def self.up
    create_table :channels do |t|
      t.column :channel_id, :string, :null => false
      t.column :tp, :integer, :null => false
      t.column :display_name, :string, :null => false
      t.column :transport_stream_id, :integer, :null => false
      t.column :original_network_id, :integer, :null => false
      t.column :service_id, :integer, :null => false, :primary => true
      t.timestamps :null => false
    end
    create_table :programmes do |t|
      t.column :start, :datetime, :null => false
      t.column :stop, :datetime, :null => false
      t.column :channel, :string, :null => false
      t.column :event_id, :integer, :null => false
      t.column :title, :string, :null => false
      t.column :desc, :string
      t.column :category, :string, :null => false
      t.timestamps :null => false
    end
  end

  def self.down
    drop_table :channels
    drop_table :programmes
  end
end
